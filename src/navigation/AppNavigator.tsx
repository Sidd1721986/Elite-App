import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { UserRole, RootStackParamList } from '../types/types';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import LoginScreen from '../screens/LoginScreen';
import SignupRoleSelectorScreen from '../screens/SignupRoleSelectorScreen';
import CustomerSignupScreen from '../screens/CustomerSignupScreen';
import VendorSignupScreen from '../screens/VendorSignupScreen';
import AdminDashboard from '../screens/AdminDashboard';
import VendorDashboard from '../screens/VendorDashboard';
import CustomerDashboard from '../screens/CustomerDashboard';
import JobDetailsScreen from '../screens/JobDetailsScreen';
import AssignVendorScreen from '../screens/AssignVendorScreen';

const Stack = createStackNavigator<RootStackParamList>();

// Memoize static screen options to prevent re-creation on each render
const authScreenOptions = { headerShown: false } as const;

const mainScreenOptions = {
    headerStyle: { backgroundColor: '#6366F1' },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '900' as const, letterSpacing: -0.5 },
};

const CUSTOMER_ROLES = new Set([
    UserRole.CUSTOMER,
    UserRole.REALTOR,
    UserRole.PROPERTY_MANAGER,
    UserRole.BUSINESS,
    UserRole.HOME_OWNER,
    UserRole.LANDLORD,
    UserRole.OTHER,
]);

const AppNavigator: React.FC = () => {
    const { user, isLoading } = useAuth();

    const isCustomerRole = React.useMemo(
        () => user ? CUSTOMER_ROLES.has(user.role) : false,
        [user?.role]
    );

    console.log('AppNavigator rendering, user:', user?.email, 'isLoading:', isLoading);

    if (isLoading) {
        console.log('AppNavigator: Showing ActivityIndicator');
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
            </View>
        );
    }

    console.log('AppNavigator: Showing Navigator, user authenticated:', !!user);

    return (
        <NavigationContainer>
            {!user ? (
                <Stack.Navigator screenOptions={authScreenOptions}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="SignupRoleSelector" component={SignupRoleSelectorScreen} />
                    <Stack.Screen name="CustomerSignup" component={CustomerSignupScreen} />
                    <Stack.Screen name="VendorSignup" component={VendorSignupScreen} />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator screenOptions={mainScreenOptions}>
                    {user.role === UserRole.ADMIN && (
                        <>
                            <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ headerShown: false }} />
                            <Stack.Screen name="VendorDashboard" component={VendorDashboard} options={{ headerShown: false }} />
                            <Stack.Screen name="CustomerDashboard" component={CustomerDashboard} options={{ headerShown: false }} />
                        </>
                    )}

                    {user.role === UserRole.VENDOR && (
                        <Stack.Screen name="VendorDashboard" component={VendorDashboard} options={{ headerShown: false }} />
                    )}

                    {isCustomerRole && (
                        <Stack.Screen name="CustomerDashboard" component={CustomerDashboard} options={{ headerShown: false }} />
                    )}

                    <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details' }} />
                    <Stack.Screen name="AssignVendor" component={AssignVendorScreen} options={{ title: 'Assign Vendor' }} />
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

export default React.memo(AppNavigator);
