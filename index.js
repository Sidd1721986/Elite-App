// Keep Metro on IPv4 loopback: `npm start` (see package.json --host 127.0.0.1) so simulator reloads match AppDelegate.
import 'react-native-gesture-handler';
import './agentDebugEarly';
import { enableScreens } from 'react-native-screens';
import { AppRegistry } from 'react-native';
import App from './App';

// Native screens + stack navigator can show a blank root on some RN 0.76 / iOS setups; JS stack is fine for this app.
enableScreens(false);

// #region agent log
(() => {
    const p = { sessionId: '5e5546', hypothesisId: 'H1', location: 'index.js:afterAppImport', message: 'App module imported OK', runId: 'pre-fix' };
    fetch('http://127.0.0.1:7543/ingest/19d4dc8e-b11b-4bee-a7b9-0b0ba8a12fb8', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5e5546' }, body: JSON.stringify({ ...p, timestamp: Date.now() }) }).catch(() => {});
    console.log('[AGENT_DEBUG_5e5546]', JSON.stringify(p));
})();
// #endregion

AppRegistry.registerComponent('multiuserauthapp', () => App);
// #region agent log
(() => {
    const p = { sessionId: '5e5546', hypothesisId: 'H1', location: 'index.js:afterRegister', message: 'AppRegistry.registerComponent done', runId: 'pre-fix' };
    fetch('http://127.0.0.1:7543/ingest/19d4dc8e-b11b-4bee-a7b9-0b0ba8a12fb8', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '5e5546' }, body: JSON.stringify({ ...p, timestamp: Date.now() }) }).catch(() => {});
    console.log('[AGENT_DEBUG_5e5546]', JSON.stringify(p));
})();
// #endregion
