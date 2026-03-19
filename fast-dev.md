# Fast Development Workflow (Elite App)

To speed up your day-to-day development, follow these practices.

## 1. Avoid Force Resets
Instead of running `npm run start:reset` every time, just use:
```bash
npm start
```
Now that caching is enabled, this will start in seconds.

## 2. Running iOS Without Re-packaging
If Metro is already running in another terminal, you can launch the app faster with:
```bash
npm run ios:no-packager
```
This skips the check for a running packager and just launches the app.

## 3. Only Clean When Necessary
Only run `npm run clean` or `npm run clean:ios` if:
- You've added a new native dependency (requires `pod install`).
- You're seeing strange "Module not found" errors that won't go away.
- You've changed `metro.config.js` or `babel.config.js`.

## 4. Keep Metro Running
Try to keep one terminal window dedicated to Metro. You rarely need to restart it unless you change environment variables or core configuration files.
