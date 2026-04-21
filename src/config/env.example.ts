/**
 * Environment-specific configuration — COPY THIS FILE to `env.ts` and fill in real values.
 *
 *   cp src/config/env.example.ts src/config/env.ts
 *
 * `env.ts` is listed in .gitignore so production URLs are never committed to source control.
 *
 * In CI/CD (Azure DevOps, GitHub Actions, etc.), generate this file from a pipeline secret
 * variable before the build step, e.g.:
 *
 *   echo "export const PRODUCTION_API_BASE_URL = '$(PROD_API_URL)';" > src/config/env.ts
 */

export const PRODUCTION_API_BASE_URL =
    'https://YOUR_API_HOST/api'; // e.g. https://api.example.com/api
