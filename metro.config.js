const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;

/**
 * - useWatchman: false — avoids Watchman recrawl hangs (connections accepted, bundle never finishes).
 * - blockList — do not crawl native/backend trees; indexing ios/Pods alone can stall Metro for minutes.
 */
module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  projectRoot,
  watchFolders: [projectRoot],
  resolver: {
    useWatchman: false,
    blockList: exclusionList([
      /[/\\]ios[/\\]Pods[/\\].*/,
      /[/\\]ios[/\\]build[/\\].*/,
      /[/\\]ios[/\\]DerivedData[/\\].*/,
      /[/\\]android[/\\]build[/\\].*/,
      /[/\\]android[/\\]\.gradle[/\\].*/,
      /[/\\]backend[/\\].*/,
      /[/\\]\.git[/\\].*/,
    ]),
  },
});
