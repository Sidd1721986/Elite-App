import AsyncStorage from '@react-native-async-storage/async-storage';
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
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

async function getAuthToken(): Promise<string | null> {
    if (typeof inMemoryAuthToken !== 'undefined') {
        return inMemoryAuthToken;
    }

    inMemoryAuthToken = await SecureStorage.getItem('auth_token');
    return inMemoryAuthToken;
}

const fetchWithTimeout = (url: string, options: RequestInit, timeout: number): Promise<Response> => {
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Request timed out')), timeout);
    });

    return Promise.race([
        fetch(url, options),
        timeoutPromise,
    ]).finally(() => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    });
};

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

        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const requestWithRetry = async (retries = 3, backoff = 1000): Promise<T> => {
            try {
                const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
                    ...options,
                    headers,
                }, REQUEST_TIMEOUT);

                if (!response.ok) {
                    // Retry on transient errors (503 Service Unavailable, 504 Gateway Timeout)
                    if (retries > 0 && (response.status === 503 || response.status === 504)) {
                        const delay = backoff * (4 - retries); // 1s, 2s, 3s
                        if (__DEV__) console.log(`[API-CLIENT] Transient error ${response.status}. Retrying in ${delay}ms...`);
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
                            if (__DEV__) console.error('onUnauthorized error:', e);
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
                            if (errorDetails) errorMessage = errorDetails;
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
                    if (__DEV__) console.log('API CLIENT THROWING:', errorMessage);
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
                // Retry on network/timeout errors
                if (retries > 0 && (err.message === 'Request timed out' || err.message === 'Network request failed')) {
                    const delay = backoff * (4 - retries);
                    if (__DEV__) console.log(`[API-CLIENT] Network error: ${err.message}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return requestWithRetry(retries - 1, backoff);
                }
                throw err;
            } finally {
                if (method === 'GET') {
                    pendingRequests.delete(endpoint);
                }
            }
        };

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
