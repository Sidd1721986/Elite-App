import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Register under app.json name (elitehomeservice)
AppRegistry.registerComponent(appName, () => App);
// Legacy / alternate names so native builds always find the component
AppRegistry.registerComponent('multiuserauthapp', () => App);
AppRegistry.registerComponent('EliteAppTemp', () => App);
