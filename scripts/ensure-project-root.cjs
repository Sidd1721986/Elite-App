#!/usr/bin/env node
/**
 * Fails fast if the packager is started from the wrong directory (common cause of
 * "has not been registered" / wrong bundle).
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error(
    '\n[react-native] No package.json in the current directory.\n' +
      '  cd into your app root first, e.g.:\n' +
      '  cd /path/to/multi-user-auth-app && npm start\n'
  );
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
if (pkg.name !== 'multiuserauthapp') {
  console.error(
    `\n[react-native] Wrong project: package.json name is "${pkg.name}", expected "multiuserauthapp".\n` +
      '  Start the bundler from the multi-user-auth-app repository root.\n'
  );
  process.exit(1);
}
