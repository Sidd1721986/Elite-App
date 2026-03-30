const path = require('path');

/**
 * Plain React Native CLI (Metro). Matches ios "Bundle React Native" script (react-native-xcode.sh).
 * For Re.Pack/Webpack again, add: commands: require('@callstack/repack/commands/webpack')
 */
module.exports = {
    project: {
        ios: {
            automaticPodsInstallation: false,
        },
        android: {},
    },
    reactNativePath: path.resolve(__dirname, 'node_modules/react-native'),
    assets: ['./assets/fonts/'],
};
