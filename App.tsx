import * as React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { JobProvider } from './src/context/JobContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StyleSheet } from 'react-native';

const theme = {
    ...MD3LightTheme,
    colors: {
        ...MD3LightTheme.colors,
        primary: '#6366F1', // Premium Indigo
        secondary: '#F59E0B', // Elite Gold/Amber
        tertiary: '#10B981', // Success Emerald
        background: '#F8FAFC', // Slate background
        surface: '#FFFFFF',
        error: '#EF4444',
        outline: '#E2E8F0',
    },
    roundness: 16, // Smoother rounded corners for a modern feel
};

export default function App() {
    console.log('App rendering');
    return (
        <GestureHandlerRootView style={styles.container}>
            <PaperProvider theme={theme}>
                <AuthProvider>
                    <JobProvider>
                        <AppNavigator />
                        <StatusBar barStyle="dark-content" />
                    </JobProvider>
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
