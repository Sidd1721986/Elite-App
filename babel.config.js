module.exports = {
    presets: ['@react-native/babel-preset'],
    plugins: [
        'react-native-reanimated/plugin',
        // Strip all console.* calls from production/release builds
        ...(process.env.NODE_ENV === 'production' ? ['transform-remove-console'] : []),
    ],
};
