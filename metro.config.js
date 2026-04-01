const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

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
    // Newer Metro/metro-config versions don't expose the old
    // `metro-config/src/defaults/exclusionList` entrypoint.
    // `resolver.blockList` accepts an array of regex patterns, so we inline it.
    blockList: [
      /[/\\]ios[/\\]Pods[/\\].*/,
      /[/\\]ios[/\\]build[/\\].*/,
      /[/\\]ios[/\\]DerivedData[/\\].*/,
      /[/\\]android[/\\]build[/\\].*/,
      /[/\\]android[/\\]\.gradle[/\\].*/,
      /[/\\]backend[/\\].*/,
      /[/\\]\.git[/\\].*/,
    ],
  },
});
