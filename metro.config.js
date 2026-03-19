const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resetCache: false,
  resolver: {
    useWatchman: false,
    blacklistRE: /ios\/build|(?:\/|^)backend\/(?!.*\.js$)|android\/app\/build/,
  },
  watchFolders: [__dirname],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
