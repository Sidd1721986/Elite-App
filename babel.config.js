module.exports = function (api) {
    api.cache(true);
    const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.BABEL_ENV === 'production';

    return {
        presets: ['@react-native/babel-preset'],
        plugins: [
            'react-native-reanimated/plugin',
            // Strip all console.* calls from production/release builds
            ...(isProduction ? ['transform-remove-console'] : []),
        ],
    };
};

