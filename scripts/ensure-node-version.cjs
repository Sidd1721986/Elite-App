#!/usr/bin/env node
/**
 * Requires Node 20.x (see package.json engines and .nvmrc). Blocks other majors.
 */
const major = Number((process.versions.node || '0').split('.')[0]);
const requiredMajors = [20, 22];

if (!requiredMajors.includes(major)) {
  console.error(
    `\n[node-version] Detected Node ${process.versions.node}. This project requires Node ${requiredMajor}.x (see .nvmrc and package.json engines).\n` +
      '  Fix:\n' +
      '  nvm use\n'
  );
  process.exit(1);
}
