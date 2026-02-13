import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StyleSheet } from 'react-native';

const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6200EE',
        secondary: '#03DAC6',
    },
};

export default function App() {
    return (
        <GestureHandlerRootView style={styles.container}>
            <PaperProvider theme={theme}>
                <AuthProvider>
                    <AppNavigator />
                    <StatusBar style="auto" />
                </AuthProvider>
            </PaperProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
