import * as React from 'react';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import type { NavigationContainerRef } from '@react-navigation/native';
import { navigationIntegration } from '../services/sentry';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../context/AuthContext';
import { User, UserRole, RootStackParamList } from '../types/types';
import { ActivityIndicator, View, StyleSheet, Text, Pressable } from 'react-native';
import { DevSettings } from 'react-native';

import LandingScreen from '../screens/LandingScreen';
import LoginScreen from '../screens/LoginScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import UserSignupScreen from '../screens/UserSignupScreen';
import VendorSignupScreen from '../screens/VendorSignupScreen';
import AdminDashboard from '../screens/AdminDashboard';
import VendorDashboard from '../screens/VendorDashboard';
import UserDashboard from '../screens/UserDashboard';
import JobDetailsScreen from '../screens/JobDetailsScreen';
import AssignVendorScreen from '../screens/AssignVendorScreen';
import ChatScreen from '../screens/ChatScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AccountDetailsScreen from '../screens/AccountDetailsScreen';
import PrivacyPolicyScreen from '../screens/PrivacyPolicyScreen';
import TermsOfServiceScreen from '../screens/TermsOfServiceScreen';
import ContactSupportScreen from '../screens/ContactSupportScreen';
import InviteAdminScreen from '../screens/InviteAdminScreen';
import AdminRegisterScreen from '../screens/AdminRegisterScreen';
import { Linking } from 'react-native';

const Stack = createStackNavigator<RootStackParamList>();

const linking = {
    prefixes: ['eliteapp://'],
    config: {
        screens: {
            AdminRegister: {
                path: 'admin-register',
                parse: {
                    token: (token: string) => token,
                    email: (email: string) => decodeURIComponent(email),
                },
            },
        },
    },
};

const navTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: '#F8FAFC',
    },
};

const authScreenOptions = {
    headerShown: false,
    cardStyle: { flex: 1, backgroundColor: '#F8FAFC' },
} as const;

const mainScreenOptions = {
    headerStyle: { backgroundColor: '#6366F1' },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '900' as const, letterSpacing: -0.5 },
    cardStyle: { flex: 1, backgroundColor: '#F8FAFC' },
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

function roleKey(role: unknown): string {
    return String(role ?? '').trim().toLowerCase();
}

function isCustomerRoleUser(user: User | null): boolean {
    if (!user) {return false;}
    if (CUSTOMER_ROLES.has(user.role)) {return true;}
    const r = roleKey(user.role);
    return [...CUSTOMER_ROLES].some((x) => String(x).toLowerCase() === r);
}

function mainInitialRoute(user: User, customerRole: boolean): keyof RootStackParamList {
    const r = roleKey(user.role);
    if (r === 'admin') {return 'AdminDashboard';}
    if (r === 'vendor') {return 'VendorDashboard';}
    if (customerRole || r === 'customer') {return 'UserDashboard';}
    return 'RoleFallback';
}

const RoleFallbackScreen: React.FC = () => {
    const { logout, user } = useAuth();
    return (
        <View style={roleFallbackStyles.box}>
            <Text style={roleFallbackStyles.title}>Account setup</Text>
            <Text style={roleFallbackStyles.body}>
                We couldn&apos;t open a home screen for role &quot;{String(user?.role)}&quot;. Sign out and try again, or contact support.
            </Text>
            <Pressable style={roleFallbackStyles.btn} onPress={() => void logout()}>
                <Text style={roleFallbackStyles.btnText}>Sign out</Text>
            </Pressable>
        </View>
    );
};

const roleFallbackStyles = StyleSheet.create({
    box: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#F8FAFC',
    },
    title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
    body: { fontSize: 15, color: '#64748B', lineHeight: 22 },
    btn: {
        marginTop: 28,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#6366F1',
        alignItems: 'center',
    },
    btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

const AppNavigator: React.FC = () => {
    const { user, isLoading } = useAuth();
    const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);

    const customerRole = React.useMemo(() => isCustomerRoleUser(user), [user]);
    const isAdmin = Boolean(user && roleKey(user.role) === 'admin');
    const isVendor = Boolean(user && roleKey(user.role) === 'vendor');

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Loading…</Text>
                {__DEV__ && typeof DevSettings?.reload === 'function' && (
                    <Pressable style={styles.reloadButton} onPress={() => DevSettings.reload()}>
                        <Text style={styles.reloadButtonText}>Reload</Text>
                    </Pressable>
                )}
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: navTheme.colors.background }}>
            <NavigationContainer
                theme={navTheme}
                linking={linking}
                ref={navigationRef}
                onReady={() => {
                    navigationIntegration?.registerNavigationContainer(navigationRef.current);
                }}
            >
            {!user ? (
                <Stack.Navigator
                    detachInactiveScreens={false}
                    screenOptions={authScreenOptions}
                    initialRouteName="Landing"
                >
                    <Stack.Screen name="Landing" component={LandingScreen} />
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                    <Stack.Screen name="UserSignup" component={UserSignupScreen} />
                    <Stack.Screen name="VendorSignup" component={VendorSignupScreen} />
                    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy', headerShown: false }} />
                    <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ title: 'Terms of Service', headerShown: false }} />
                    <Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ title: 'Help & Support', headerShown: false }} />
                    <Stack.Screen name="AdminRegister" component={AdminRegisterScreen} options={{ title: 'Create Admin Account', headerShown: false }} />
                </Stack.Navigator>
            ) : (
                <Stack.Navigator
                    key={user.id} // VITAL: Forces reset of all navigation state on identity change
                    detachInactiveScreens={false}
                    screenOptions={mainScreenOptions}
                    initialRouteName={mainInitialRoute(user, customerRole)}
                >
                    {isAdmin ? (
                        <>
                            <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ headerShown: false }} />
                            <Stack.Screen name="VendorDashboard" component={VendorDashboard} options={{ headerShown: false }} />
                            <Stack.Screen name="UserDashboard" component={UserDashboard} options={{ headerShown: false }} />
                        </>
                    ) : isVendor ? (
                        <Stack.Screen name="VendorDashboard" component={VendorDashboard} options={{ headerShown: false }} />
                    ) : (
                        <Stack.Screen name="UserDashboard" component={UserDashboard} options={{ headerShown: false }} />
                    )}

                    <Stack.Screen name="RoleFallback" component={RoleFallbackScreen} options={{ headerShown: false }} />

                    <Stack.Screen name="JobDetails" component={JobDetailsScreen} options={{ title: 'Job Details', headerShown: false }} />
                    <Stack.Screen name="AssignVendor" component={AssignVendorScreen} options={{ title: 'Assign Vendor', headerShown: false }} />
                    <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat', headerShown: false }} />
                    <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile Settings', headerShown: false }} />
                    <Stack.Screen name="AccountDetails" component={AccountDetailsScreen} options={{ title: 'Account Details', headerShown: false }} />
                    <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: 'Privacy Policy', headerShown: false }} />
                    <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ title: 'Terms of Service', headerShown: false }} />
                    <Stack.Screen name="ContactSupport" component={ContactSupportScreen} options={{ title: 'Help & Support', headerShown: false }} />
                    <Stack.Screen name="InviteAdmin" component={InviteAdminScreen} options={{ title: 'Invite Admin', headerShown: false }} />
                    <Stack.Screen name="AdminRegister" component={AdminRegisterScreen} options={{ title: 'Create Admin Account', headerShown: false }} />
                </Stack.Navigator>
            )}
            </NavigationContainer>
        </View>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#64748B',
    },
    reloadButton: {
        marginTop: 24,
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#6366F1',
        borderRadius: 8,
    },
    reloadButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default React.memo(AppNavigator);
