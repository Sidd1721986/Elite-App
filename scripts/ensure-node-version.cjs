#!/usr/bin/env node
/**
 * Keeps local tooling on Node 20 to avoid Metro/runtime instability on newer majors.
 */
const major = Number((process.versions.node || '0').split('.')[0]);
const required = 20;

if (major !== required) {
  console.error(
    `\n[node-version] Detected Node ${process.versions.node}. This project requires Node ${required}.x for stable Metro.\n` +
      '  Fix:\n' +
      '  nvm use 20\n'
  );
  process.exit(1);
}
