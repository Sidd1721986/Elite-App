const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Stricter blockList to prevent indexing massive native/backend trees.
    blockList: [
      /.*[/\\](ios[/\\]Pods|ios[/\\]build|ios[/\\]DerivedData|android[/\\]build|android[/\\]\.gradle|backend|node_modules[/\\]\.cache|\.git)[/\\].*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
