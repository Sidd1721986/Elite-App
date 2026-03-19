import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

console.log('--- APP REGISTRATION START ---', appName);

// Register under standardized name
AppRegistry.registerComponent('multiuserauthapp', () => App);
// Fallback if appName is used elsewhere
if (appName !== 'multiuserauthapp') {
    AppRegistry.registerComponent(appName, () => App);
}
