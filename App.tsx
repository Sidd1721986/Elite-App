import * as React from 'react';
import { View, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/context/AuthContext';
import { JobProvider } from './src/context/JobContext';
import AppNavigator from './src/navigation/AppNavigator';

type ErrorBoundaryState = { error: Error | null };

/* eslint-disable react-native/no-inline-styles */
import { Button } from 'react-native-paper';

class RootErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error): void {
        if (__DEV__) {
            console.error('Root render error:', error);
        }
        // In production, you would log to Sentry/AppInsights here
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        if (this.state.error) {
            return (
                <View style={errorStyles.box}>
                    <Text style={errorStyles.title}>Something went wrong</Text>
                    <Text style={errorStyles.msg}>{this.state.error.message}</Text>
                    <Button 
                        mode="contained" 
                        onPress={this.handleReset}
                        style={{ marginTop: 24, borderRadius: 8 }}
                        buttonColor="#991B1B"
                    >
                        Try Again
                    </Button>
                </View>
            );
        }
        return this.props.children;
    }
}

const errorStyles = StyleSheet.create({
    box: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#FEF2F2',
    },
    title: { fontSize: 20, fontWeight: '700', color: '#991B1B', marginBottom: 12 },
    msg: { fontSize: 14, color: '#7F1D1D' },
});

export default function App() {
    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#312E81' }}>
            <StatusBar
                barStyle="light-content"
                backgroundColor={Platform.OS === 'android' ? '#312E81' : undefined}
            />
            <RootErrorBoundary>
                <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                    <PaperProvider theme={MD3LightTheme}>
                        <AuthProvider>
                            <JobProvider>
                                <AppNavigator />
                            </JobProvider>
                        </AuthProvider>
                    </PaperProvider>
                </SafeAreaProvider>
            </RootErrorBoundary>
        </GestureHandlerRootView>
    );
}
