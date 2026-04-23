const path = require('path');
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
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'expo-linear-gradient') {
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'src/shims/expo-linear-gradient.js'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
