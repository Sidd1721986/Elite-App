// Sentry crash reporting is disabled.
//
// The @sentry/react-native native module (Sentry-Cocoa 9.x) has a Swift-module
// incompatibility with the iOS static-library + Xcode 16 build setup. Rather than
// block shipping, Sentry is stubbed out here as a no-op so all call sites keep
// working. Backend/server errors are still tracked by Azure Application Insights.
//
// To re-enable later: re-add "@sentry/react-native" to package.json, restore the
// real implementation below, and resolve the iOS module build issue.

// Typed so optional-chained call sites (navigationIntegration?.registerNavigationContainer(...))
// still typecheck while the value is a no-op null at runtime.
export const navigationIntegration: { registerNavigationContainer: (ref: unknown) => void } | null = null;

export function initSentry(): void {
    // no-op — crash reporting disabled
}

export const Sentry = {
    // Returns the app component unchanged (real Sentry.wrap adds error boundaries).
    wrap: <T,>(component: T): T => component,
    // Swallows manually-reported exceptions; real Sentry would send them upstream.
    captureException: (_error: unknown): void => {
        // no-op
    },
};
