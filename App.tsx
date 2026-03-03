import * as React from 'react';
import { StatusBar, View, Text, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { JobProvider } from './src/context/JobContext';
import AppNavigator from './src/navigation/AppNavigator';
import { StyleSheet } from 'react-native';

class AppErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    state = { hasError: false, error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('App Error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError && this.state.error) {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorTitle}>Something went wrong</Text>
                    <ScrollView style={styles.errorScroll}>
                        <Text style={styles.errorText}>{this.state.error.message}</Text>
                    </ScrollView>
                </View>
            );
        }
        return this.props.children;
    }
}

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
    const [ready, setReady] = React.useState(false);
    React.useEffect(() => {
        const t = setTimeout(() => setReady(true), 150);
        return () => clearTimeout(t);
    }, []);

    return (
        <View style={styles.root}>
            {!ready ? (
                <View style={styles.bootstrap}>
                    <Text style={styles.bootstrapText}>Elite</Text>
                    <Text style={styles.bootstrapSub}>Loading…</Text>
                </View>
            ) : (
                <AppErrorBoundary>
                    <AppContent />
                </AppErrorBoundary>
            )}
        </View>
    );
}

const AppContent = React.memo(function AppContent() {
    return (
        <SafeAreaProvider>
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
        </SafeAreaProvider>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#F8FAFC',
    },
    errorTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        color: '#1E293B',
    },
    errorScroll: {
        maxHeight: 200,
    },
    errorText: {
        fontSize: 14,
        color: '#64748B',
    },
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    bootstrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
    },
    bootstrapText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1E293B',
    },
    bootstrapSub: {
        marginTop: 8,
        fontSize: 16,
        color: '#64748B',
    },
});
