import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, Snackbar, Menu, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import AppLogo from '../components/AppLogo';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const ROLES: UserRole[] = [UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER];

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
    const resetToastShown = useRef(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(true);
    const { login } = useAuth();

    useEffect(() => {
        if (route.params?.passwordResetOk && !resetToastShown.current) {
            resetToastShown.current = true;
            setSnackbarMessage('Password updated. Sign in with your new password.');
            setSnackbarVisible(true);
        }

        if (route.params?.initialRole) {
            setSelectedRole(route.params.initialRole);
        }
    }, [route.params?.passwordResetOk, route.params?.initialRole]);

    useEffect(() => {
        setShowForgotPassword(true);
    }, []);

    const handleLogin = useCallback(async () => {
        if (!email || !password) {
            setSnackbarMessage('Please fill in all fields');
            setSnackbarVisible(true);
            return;
        }
        setLoading(true);
        const result = await login(email, password, selectedRole);
        setLoading(false);
        if (result !== true) {
            setSnackbarMessage(typeof result === 'string' ? result : 'Invalid credentials or wrong role selected');
            setSnackbarVisible(true);
        }
    }, [email, password, selectedRole, login]);

    const handleSignupPress = useCallback(() => {
        if (selectedRole === UserRole.VENDOR) {
            navigation.navigate('VendorSignup');
        } else {
            navigation.navigate('UserSignup');
        }
    }, [navigation, selectedRole]);

    const dismissSnackbar = useCallback(() => setSnackbarVisible(false), []);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.decoratorCircle1} />
            <View style={styles.decoratorCircle2} />
            <View style={styles.decoratorCircle3} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                {/* Top-left Back Button */}
                <View style={styles.topNav}>
                    <Button
                        mode="text"
                        onPress={() => navigation.navigate('Landing')}
                        icon="arrow-left"
                        labelStyle={styles.backButtonLabel}
                        style={styles.backButton}
                    >
                        Role
                    </Button>
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        <View style={styles.headerSection}>
                            <AppLogo size={100} />
                            <Text variant="headlineMedium" style={styles.brandTitle} numberOfLines={1}>
                                <Text style={styles.brandElite}>Elite</Text>
                                <Text style={styles.brandHome}> Home Services</Text>
                            </Text>
                            <View style={styles.roleTitleContainer}>
                                <Text style={styles.roleLoginTitle}>
                                    {String(selectedRole).toUpperCase() === 'CUSTOMER' ? 'USER' : selectedRole} Login
                                </Text>
                            </View>
                        </View>

                        <Card style={styles.card} elevation={0}>
                            <Card.Content style={styles.cardInner}>
                                <TextInput
                                    label="Email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    mode="outlined"
                                    style={styles.input}
                                    outlineColor="#E2E8F0"
                                    activeOutlineColor="#6366F1"
                                    left={<TextInput.Icon icon="email-outline" color="#94A3B8" />}
                                />

                                <TextInput
                                    label="Password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    mode="outlined"
                                    style={styles.input}
                                    outlineColor="#E2E8F0"
                                    activeOutlineColor="#6366F1"
                                    returnKeyType="done"
                                    onSubmitEditing={handleLogin}
                                    blurOnSubmit
                                    left={<TextInput.Icon icon="lock-outline" color="#94A3B8" />}
                                />

                                <Button
                                    mode="contained"
                                    onPress={handleLogin}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.loginButton}
                                    contentStyle={styles.loginButtonContent}
                                    labelStyle={styles.loginButtonLabel}
                                >
                                    Log In
                                </Button>

                                <View style={styles.secondaryActions}>
                                    {showForgotPassword ? (
                                        <Button
                                            mode="text"
                                            onPress={() =>
                                                navigation.navigate('ForgotPassword', {
                                                    initialEmail: email,
                                                    initialRole: selectedRole,
                                                })
                                            }
                                            style={styles.forgotButton}
                                            labelStyle={styles.forgotButtonLabel}
                                        >
                                            Forgot password?
                                        </Button>
                                    ) : null}
                                </View>


                                {selectedRole !== UserRole.ADMIN && (
                                    <View style={styles.footerLinks}>
                                        <Button
                                            mode="text"
                                            onPress={handleSignupPress}
                                            style={styles.signupButton}
                                            labelStyle={styles.signupButtonLabel}
                                        >
                                            New to Elite? <Text style={styles.signupAccent}>Join Now</Text>
                                        </Button>
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    </View>
                </ScrollView>

                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={dismissSnackbar}
                    duration={3000}
                    style={styles.snackbar}
                >
                    {snackbarMessage}
                </Snackbar>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC', // Soft bright slate
    },
    decoratorCircle1: {
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#6366F115', // Indigo Glow (subtle)
    },
    decoratorCircle2: {
        position: 'absolute',
        bottom: -50,
        left: -80,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#06B6D410', // Cyan Glow (subtle)
    },
    decoratorCircle3: {
        position: 'absolute',
        top: '40%',
        right: -100,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#F43F5E08', // Rose Glow (very subtle)
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    headerSection: {
        alignItems: 'center',
        marginBottom: 40,
    },
    brandTitle: {
        fontWeight: '900',
        letterSpacing: -1.0,
        textAlign: 'center',
        textShadowColor: 'rgba(99, 102, 241, 0.12)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 12,
        fontSize: 32,
    },
    brandElite: {
        color: '#6366F1', // Back to Indigo
    },
    brandHome: {
        color: '#1E293B', // Back to Dark Slate
    },
    brandSubtitle: {
        color: '#94A3B8',
        marginTop: 8,
        letterSpacing: 1.5,
        fontWeight: '700',
        opacity: 0.85,
        fontSize: 10,
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.7)', // Brighter glassmorphism
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    cardInner: {
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderRadius: 32,
        overflow: 'hidden',
    },
    input: {
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.5)', // Brighter blending
    },
    menuContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
    },
    roleTitleContainer: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: '#6366F110',
        borderRadius: 20,
    },
    roleLoginTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#6366F1',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    secondaryActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    topNav: {
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 100,
    },
    backButton: {
        marginLeft: -8,
    },
    backButtonLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
    },
    loginButton: {
        marginTop: 24,
        borderRadius: 12,
        backgroundColor: '#6366F1',
    },
    loginButtonContent: {
        height: 56,
    },
    loginButtonLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    forgotButton: {
        marginTop: 4,
        alignSelf: 'center',
    },
    forgotButtonLabel: {
        color: '#6366F1',
        fontSize: 14,
        fontWeight: '600',
    },
    footerLinks: {
        marginTop: 16,
        alignItems: 'center',
    },
    signupButton: {
        marginTop: 8,
    },
    signupButtonLabel: {
        color: '#64748B',
        fontSize: 14,
    },
    signupAccent: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
    snackbar: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
    },
});

export default React.memo(LoginScreen);
