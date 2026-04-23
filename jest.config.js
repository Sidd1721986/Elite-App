module.exports = {
    preset: 'react-native',
    watchman: false,
    roots: ['<rootDir>/src'],
    testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './jest.setup.js'],
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-paper|react-native-safe-area-context|react-native-gesture-handler|react-native-vector-icons|moti|@shopify/flash-list|react-native-reanimated)/)',
    ],
    testEnvironment: 'node',
};
