#!/usr/bin/env node
/**
 * Deletes ./node_modules reliably on macOS where rimraf/rm often hit ENOTEMPTY
 * (iCloud, Spotlight, antivirus, or stale file handles).
 * Strategy: rename out of the project, then fs.rmSync with retries.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const nm = path.join(root, 'node_modules');

if (!fs.existsSync(nm)) {
  process.exit(0);
}

const trash = path.join(
  os.tmpdir(),
  `multiuserauthapp-node_modules-${Date.now()}-${process.pid}`
);

try {
  fs.renameSync(nm, trash);
} catch (e) {
  console.error(
    '[remove-node-modules] Could not move node_modules aside. Close Metro, Xcode, Android Studio, and Cursor; then retry.\n',
    e.message
  );
  process.exit(1);
}

try {
  fs.rmSync(trash, {
    recursive: true,
    force: true,
    maxRetries: 15,
    retryDelay: 200,
  });
} catch (e) {
  console.error(
    '[remove-node-modules] Leftover folder — delete it manually when nothing is using it:\n  ' +
      trash +
      '\n',
    e.message
  );
  process.exit(1);
}
