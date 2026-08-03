import { SecureStorage } from './secureStorage';
import { Platform } from 'react-native';
import { DEV_API_HOST, getProductionApiBaseUrl } from '../config/appConfig';

const PROD_URL = getProductionApiBaseUrl();

if (!__DEV__ && !/^https:\/\//i.test(PROD_URL)) {
    throw new Error('Production API URL must use https://. Edit PRODUCTION_API_BASE_URL in src/config/appConfig.ts.');
}

// Must match the API host port (Kestrel listens on 5260 for `dotnet run` and matches "5260:5260" in Docker). If you map a different host port (e.g. "5265:5260"), set this to that host port.
const DEV_API_PORT = 5260;

/** Hostname of the machine running Metro (same Mac that should run `dotnet run`). */
function getPackagerHostname(): string | null {
    try {
        // Same helper RN uses for devtools; bundle URL is e.g. http://192.168.1.5:8081/ on a physical device

        const getDevServer = require('react-native/Libraries/Core/Devtools/getDevServer') as () => { url: string };
        const { url } = getDevServer();
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

function devApiBaseUrl(): string {
    const host = DEV_API_HOST.trim();
    if (host) {
        return `http://${host}:${DEV_API_PORT}/api`;
    }

    const packagerHost = getPackagerHostname();
    const usePackagerHost =
        packagerHost &&
        packagerHost !== 'localhost' &&
        packagerHost !== '127.0.0.1';

    if (usePackagerHost) {
        // Physical device (or Metro bound to LAN): API must use the same host as the JS bundle, not loopback.
        return `http://${packagerHost}:${DEV_API_PORT}/api`;
    }

    if (Platform.OS === 'android') {
        // Emulator → host loopback via special alias
        return `http://10.0.2.2:${DEV_API_PORT}/api`;
    }

    // iOS simulator: 127.0.0.1 avoids localhost → ::1 mismatches with Kestrel
    return `http://127.0.0.1:${DEV_API_PORT}/api`;
}

const BASE_URL = __DEV__ ? devApiBaseUrl() : PROD_URL;

// Response cache with TTL — set to 0 to always fetch fresh data and avoid stale lists
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes in milliseconds

// In-flight request deduplication — prevents duplicate identical GETs within same tick
const pendingRequests = new Map<string, Promise<any>>();

// Dev: allow slow first request (DB cold start). Prod: keep tight.
const REQUEST_TIMEOUT = __DEV__ ? 30000 : 15000;

let onUnauthorized: (() => void | Promise<void>) | null = null;
let inMemoryAuthToken: string | null | undefined;

export function setApiClientOnUnauthorized(callback: () => void | Promise<void>) {
    onUnauthorized = callback;
}

export function setApiClientAuthToken(token: string | null) {
    inMemoryAuthToken = token;
}

/** Clears the cached token so the next request reloads from SecureStorage (tests, logout edge cases). */
export function clearApiClientInMemoryToken() {
    inMemoryAuthToken = undefined;
}

async function getAuthToken(): Promise<string | null> {
    if (typeof inMemoryAuthToken !== 'undefined') {
        return inMemoryAuthToken;
    }

    inMemoryAuthToken = await SecureStorage.getItem('auth_token');
    return inMemoryAuthToken;
}

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
    // AbortController actually cancels the underlying request on timeout. The previous
    // Promise.race left the fetch running, so a retry stacked a second live request on a
    // server that was already struggling.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
};

/** Linear backoff with jitter so synchronized clients don't retry in waves. */
const retryDelay = (attempt: number, backoff: number) =>
    backoff * attempt + Math.floor(Math.random() * 500);

export const apiClient = {
    async request<T>(endpoint: string, options: RequestInit = {}, bypassCache = false): Promise<T> {
        const method = options.method || 'GET';

        // Cache check for GET requests
        if (method === 'GET' && !bypassCache) {
            const cached = cache.get(endpoint);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                return cached.data;
            }

            // Deduplicate in-flight GET requests
            const pending = pendingRequests.get(endpoint);
            if (pending) {
                return pending;
            }
        }

        const token = await getAuthToken();

        // For FormData bodies (file uploads) we must NOT set Content-Type: React Native's fetch
        // generates 'multipart/form-data; boundary=...' from the body. Forcing application/json
        // (or even a boundary-less multipart/form-data) makes the server unable to parse the upload.
        const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

        const headers = {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const requestWithRetry = async (retries = 3, backoff = 1000): Promise<T> => {
            const url = `${BASE_URL}${endpoint}`;
            if (__DEV__) {console.log(`[API-CLIENT] ${method} ${url}`);}
            try {
                const response = await fetchWithTimeout(url, {
                    ...options,
                    headers,
                }, REQUEST_TIMEOUT);

                if (!response.ok) {
                    // Retry transient errors (503/504) for GETs only. A timed-out or 5xx POST may
                    // have already been applied server-side — retrying it creates duplicate jobs,
                    // messages, and payment sessions exactly when the server is struggling.
                    if (retries > 0 && method === 'GET' && (response.status === 503 || response.status === 504)) {
                        const delay = retryDelay(4 - retries, backoff);
                        if (__DEV__) {console.log(`[API-CLIENT] Transient error ${response.status}. Retrying in ${delay}ms...`);}
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return requestWithRetry(retries - 1, backoff);
                    }

                    const errorText = await response.text().catch(() => 'No response body');
                    if (__DEV__ && response.status !== 401) {
                        console.error(`API Error [${response.status}] ${method} ${endpoint}:`, errorText);
                    }

                    if (response.status === 401 && onUnauthorized) {
                        setApiClientAuthToken(null);
                        try {
                            await Promise.resolve(onUnauthorized());
                        } catch (e) {
                            if (__DEV__) {console.error('onUnauthorized error:', e);}
                        }
                    }

                    let errorMessage = `HTTP error! status: ${response.status}`;
                    let traceId: string | undefined;

                    try {
                        const errorJson = JSON.parse(errorText);
                        traceId = errorJson.traceId;

                        // Handle standard { message: "..." }
                        if (errorJson.message) {
                            errorMessage = errorJson.message;
                        }
                        // Handle ASP.NET validation errors { errors: { Field: ["error"] } }
                        else if (errorJson.errors && typeof errorJson.errors === 'object') {
                            const errorDetails = Object.entries(errorJson.errors)
                                .map(([field, messages]) => {
                                    const msg = Array.isArray(messages) ? messages[0] : messages;
                                    return `${field}: ${msg}`;
                                })
                                .join(', ');
                            if (errorDetails) {errorMessage = errorDetails;}
                        }
                        else if (errorJson.error) {
                            errorMessage = errorJson.error;
                        }
                    } catch {
                        // Not JSON, use default or snippet of text
                        if (errorText && errorText.length < 100) {
                            errorMessage = errorText;
                        }
                    }
                    if (__DEV__) {console.log('API CLIENT THROWING:', errorMessage);}
                    const error = new Error(errorMessage) as any;
                    error.traceId = traceId;
                    throw error;
                }

                const data = await response.json();

                // Cache successful GET responses only when caching is enabled
                if (method === 'GET' && CACHE_TTL > 0) {
                    cache.set(endpoint, { data, timestamp: Date.now() });
                }

                // Invalidate related caches on mutations
                if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
                    // e.g., POST /jobs should invalidate GET /jobs cache
                    const basePath = endpoint.split('/').slice(0, 2).join('/');
                    for (const key of cache.keys()) {
                        if (key.startsWith(basePath)) {
                            cache.delete(key);
                        }
                    }
                }

                return data;
            } catch (err: any) {
                // Retry network/timeout errors for GETs only — a non-GET that timed out may have
                // succeeded server-side (see comment above on duplicate side effects).
                if (retries > 0 && method === 'GET' && (err.message === 'Request timed out' || err.message === 'Network request failed')) {
                    const delay = retryDelay(4 - retries, backoff);
                    if (__DEV__) {console.log(`[API-CLIENT] Network error: ${err.message}. Retrying in ${delay}ms...`);}
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return requestWithRetry(retries - 1, backoff);
                }
                throw err;
            } finally {
                // Only drop the entry if it is still OURS. A bypass-cache GET for the same
                // endpoint overwrites the map entry while this request is in flight; deleting
                // unconditionally would evict that newer promise and lose its deduplication.
                if (method === 'GET' && pendingRequests.get(endpoint) === requestPromise) {
                    pendingRequests.delete(endpoint);
                }
            }
        };

        // The `finally` above closes over this binding; it can only run after the first await,
        // by which point the assignment has completed.
        const requestPromise = requestWithRetry();

        // Track in-flight GET requests for deduplication BEFORE returning
        // (set immediately after promise creation to close the race window)
        if (method === 'GET') {
            pendingRequests.set(endpoint, requestPromise);
        }

        return requestPromise;
    },

    get<T>(endpoint: string, bypassCache = false) {
        return this.request<T>(endpoint, { method: 'GET' }, bypassCache);
    },

    post<T>(endpoint: string, body: any) {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    put<T>(endpoint: string, body: any) {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    },

    delete<T>(endpoint: string) {
        return this.request<T>(endpoint, { method: 'DELETE' });
    },

    // Manual cache invalidation
    clearCache() {
        cache.clear();
    },
};
