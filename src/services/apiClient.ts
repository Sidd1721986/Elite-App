import AsyncStorage from '@react-native-async-storage/async-storage';

// In production, change this to your Azure Web App URL (e.g., https://eliteapp-app-prod.azurewebsites.net/api)
const PROD_URL = 'https://elite-services-api.azurewebsites.net/api'; 
const BASE_URL = __DEV__ ? 'http://localhost:5260/api' : PROD_URL;

// Response cache with TTL — set to 0 to always fetch fresh data and avoid stale lists
const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 0; // Disabled: always hit server for fresh data

// In-flight request deduplication — prevents duplicate identical GETs within same tick
const pendingRequests = new Map<string, Promise<any>>();

// Request timeout (10 seconds)
const REQUEST_TIMEOUT = 10000;

let onUnauthorized: (() => void | Promise<void>) | null = null;

export function setApiClientOnUnauthorized(callback: () => void | Promise<void>) {
    onUnauthorized = callback;
}

const fetchWithTimeout = (url: string, options: RequestInit, timeout: number): Promise<Response> => {
    return Promise.race([
        fetch(url, options),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), timeout)
        ),
    ]);
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

        const token = await AsyncStorage.getItem('@auth_token');

        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const requestPromise = (async () => {
            try {
                const response = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
                    ...options,
                    headers,
                }, REQUEST_TIMEOUT);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'No response body');
                    if (__DEV__ && response.status !== 401) {
                        console.error(`API Error [${response.status}] ${method} ${endpoint}:`, errorText);
                    }

                    if (response.status === 401 && onUnauthorized) {
                        try {
                            await Promise.resolve(onUnauthorized());
                        } catch (e) {
                            if (__DEV__) console.error('onUnauthorized error:', e);
                        }
                    }

                    let errorMessage = `HTTP error! status: ${response.status}`;
                    try {
                        const errorJson = JSON.parse(errorText);

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
                    throw new Error(errorMessage);
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
            } finally {
                pendingRequests.delete(endpoint);
            }
        })();

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
