import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { UserRole, RootStackParamList } from '../types/types';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import AdminDashboard from '../screens/AdminDashboard';
import VendorDashboard from '../screens/VendorDashboard';
import CustomerDashboard from '../screens/CustomerDashboard';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {!user ? (
                // Auth Stack - shown when user is not logged in
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                    }}
                >
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Signup" component={SignupScreen} />
                </Stack.Navigator>
            ) : (
                // Main Stack - shown when user is logged in
                <Stack.Navigator
                    screenOptions={{
                        headerStyle: {
                            backgroundColor: '#007AFF',
                        },
                        headerTintColor: '#fff',
                        headerTitleStyle: {
                            fontWeight: 'bold',
                        },
                    }}
                >
                    {user.role === UserRole.ADMIN && (
                        <>
                            <Stack.Screen
                                name="AdminDashboard"
                                component={AdminDashboard}
                                options={{ title: 'Admin Dashboard' }}
                            />
                            <Stack.Screen
                                name="VendorDashboard"
                                component={VendorDashboard}
                                options={{ title: 'Vendor Dashboard' }}
                            />
                            <Stack.Screen
                                name="CustomerDashboard"
                                component={CustomerDashboard}
                                options={{ title: 'Customer Dashboard' }}
                            />
                        </>
                    )}

                    {user.role === UserRole.VENDOR && (
                        <Stack.Screen
                            name="VendorDashboard"
                            component={VendorDashboard}
                            options={{ title: 'Vendor Dashboard' }}
                        />
                    )}

                    {user.role === UserRole.CUSTOMER && (
                        <Stack.Screen
                            name="CustomerDashboard"
                            component={CustomerDashboard}
                            options={{ title: 'Customer Dashboard' }}
                        />
                    )}
                </Stack.Navigator>
            )}
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
    },
});

export default AppNavigator;
