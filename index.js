// Keep Metro on IPv4 loopback: `npm start` (see package.json --host 127.0.0.1) so simulator reloads match AppDelegate.
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from './src/config/env';
import App from './App';

if (!__DEV__ && SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: 'production',
        tracesSampleRate: 1.0,     // 100% of transactions — reduce to 0.2 in high traffic
        attachStacktrace: true,
        enableNativeNagger: false,
    });
}

// Native screens + stack navigator can show a blank root on some RN 0.76 / iOS setups; JS stack is fine for this app.
enableScreens(false);

AppRegistry.registerComponent('multiuserauthapp', () => __DEV__ || !SENTRY_DSN ? App : Sentry.wrap(App));
