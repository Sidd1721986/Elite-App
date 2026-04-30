/** @type {Detox.DetoxConfig} */
module.exports = {
    testRunner: {
        args: {
            $0: 'jest',
            config: 'e2e/jest.config.js',
        },
        jest: {
            setupTimeout: 120000,
        },
    },
    apps: {
        'android.debug': {
            type: 'android.apk',
            binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
            build:
                'cd android && ./gradlew assembleDebug assembleDebugAndroidTest -DtestBuildType=debug --no-daemon --stacktrace',
        },
    },
    devices: {
        emulator: {
            type: 'android.emulator',
            device: { avdName: 'Pixel_6_API_31' },
        },
    },
    configurations: {
        'android.emu.debug': {
            device: 'emulator',
            app: 'android.debug',
        },
    },
};
