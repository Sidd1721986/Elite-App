import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '../config/env';

export const navigationIntegration = Sentry.reactNavigationIntegration?.({
    enableTimeToInitialDisplay: false,
}) ?? null;

export function initSentry(): void {
    if (!__DEV__ && SENTRY_DSN) {
        Sentry.init({
            dsn: SENTRY_DSN,
            environment: 'production',
            tracesSampleRate: 1.0,
            attachStacktrace: true,
            integrations: navigationIntegration ? [navigationIntegration] : [],
        });
    }
}

export { Sentry };
