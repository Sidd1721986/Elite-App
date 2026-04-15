// Keep Metro on IPv4 loopback: `npm start` (see package.json --host 127.0.0.1) so simulator reloads match AppDelegate.
import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import App from './App';

// Native screens + stack navigator can show a blank root on some RN 0.76 / iOS setups; JS stack is fine for this app.
enableScreens(false);


AppRegistry.registerComponent('multiuserauthapp', () => App);
