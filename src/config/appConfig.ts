/**
 * Development: LAN IP of the machine running the .NET API (no `http://`, no port).
 * Leave empty for simulators (iOS → localhost, Android emulator → 10.0.2.2).
 * Set when testing on a physical phone/tablet, e.g. `192.168.1.42` (same Wi‑Fi as the computer).
 */
export const DEV_API_HOST = '';

/**
 * Production HTTPS API base URL (include `/api` if your routes are under `/api`).
 *
 * Before App Store / Play release, set this to your deployed backend (same host as Azure App Service
 * or your API domain). For CI/CD, replace this string in the pipeline (e.g. sed) or split per env with
 * a small script — do not point release builds at `localhost`.
 *
 * Optional: add `react-native-config` and read `PROD_API_BASE_URL` from a root `.env` if you prefer
 * env files over editing this constant.
 */
const PRODUCTION_API_BASE_URL = 'https://eliteapp-api-test.calmpond-a079cf6a.eastus2.azurecontainerapps.io/api';

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
