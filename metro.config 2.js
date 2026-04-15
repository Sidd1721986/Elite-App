const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * STRICT ISOLATION CONFIG
 * This config forces Metro to ignore the system-level Watchman
 * and only look at the core Javascript folders.
 */
const config = {
  projectRoot: __dirname,
  watchFolders: [
    path.resolve(__dirname, 'src'),
    path.resolve(__dirname, 'node_modules'),
  ],
  resolver: {
    useWatchman: false, // FORCE OFF
    blockList: [/.*[/\\](_TEMP_ISOLATION|build|\.git)[/\\].*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
