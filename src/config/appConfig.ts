/**
 * Development: LAN IP of the machine running the .NET API (no `http://`, no port).
 * Leave empty for simulators (iOS → localhost, Android emulator → 10.0.2.2).
 * Set when testing on a physical phone/tablet, e.g. `192.168.1.42` (same Wi‑Fi as the computer).
 */
export const DEV_API_HOST = '';

/**
 * Production HTTPS API base URL — loaded from `./env` (gitignored).
 *
 * Setup:
 *   cp src/config/env.example.ts src/config/env.ts   # once, locally
 *   # then fill in your real URL in env.ts
 *
 * In CI/CD (Azure DevOps, GitHub Actions), generate env.ts from a pipeline secret before
 * the build step so the URL never lives in version control:
 *
 *   echo "export const PRODUCTION_API_BASE_URL = '$(PROD_API_URL)';" > src/config/env.ts
 */
import { PRODUCTION_API_BASE_URL } from './env';

function trimTrailingSlashes(url: string): string {
    return url.replace(/\/+$/, '');
}

export function getProductionApiBaseUrl(): string {
    return trimTrailingSlashes(PRODUCTION_API_BASE_URL);
}

/**
 * Returns the production base URL (not the /api path) for legal and support pages.
 * These are required by App Store Connect and Google Play Console.
 */
export function getProductionBaseUrl(): string {
    const apiBase = getProductionApiBaseUrl();
    // Assuming the legal routes are at the root, remove the last segment if it is '/api'
    if (apiBase.toLowerCase().endsWith('/api')) {
        return apiBase.substring(0, apiBase.length - 4);
    }
    return apiBase;
}

export const PRIVACY_POLICY_URL = `${getProductionBaseUrl()}/privacy`;
export const SUPPORT_URL = `${getProductionBaseUrl()}/support`;
export const TERMS_OF_SERVICE_URL = `${getProductionBaseUrl()}/terms`;
