import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => {
    const mocked = require('react-native-reanimated/mock');
    return {
        ...mocked,
        useReducedMotion: () => false,
    };
});

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-keychain', () => ({
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
    getGenericPassword: jest.fn(() => Promise.resolve(false)),
    setGenericPassword: jest.fn(() => Promise.resolve(true)),
    resetGenericPassword: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context'));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

// Mock navigation
jest.mock('@react-navigation/native', () => {
    return {
        ...jest.requireActual('@react-navigation/native'),
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
        useRoute: () => ({
            params: {},
        }),
    };
});

// Mock images
jest.mock('react-native/Libraries/Image/RelativeImageStub', () => 'Image');

// FlashList native module is not available in Jest; FlatList is API-compatible for tests.
jest.mock('@shopify/flash-list', () => {
    const { FlatList } = require('react-native');
    return { FlashList: FlatList };
});

jest.mock('moti', () => {
    const React = require('react');
    const { View, Text } = require('react-native');
    const passthrough = (Comp) =>
        ({ children, style, from, animate, transition, ...rest }) =>
            React.createElement(Comp, { style, ...rest }, children);
    return {
        MotiView: passthrough(View),
        MotiText: passthrough(Text),
    };
});

jest.mock('moti/skeleton', () => {
    const React = require('react');
    const { View } = require('react-native');
    return {
        Skeleton: () => React.createElement(View, { testID: 'moti-skeleton-mock' }),
    };
});
