import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, Snackbar, Menu, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLogo from '../components/AppLogo';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const ROLES: UserRole[] = [UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER];

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const { login } = useAuth();

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
        navigation.navigate('SignupRoleSelector');
    }, [navigation]);

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
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        <View style={styles.headerSection}>
                            <AppLogo size={60} />
                            <Text variant="headlineMedium" style={styles.brandTitle} numberOfLines={1}>
                                <Text style={styles.brandElite}>Elite</Text>
                                <Text style={styles.brandHome}> Home Services</Text>
                            </Text>
                            <Text variant="labelMedium" style={styles.brandSubtitle} numberOfLines={1}>
                                PREMIUM SERVICES • SEAMLESS EXPERIENCE
                            </Text>
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
                                    left={<TextInput.Icon icon="lock-outline" color="#94A3B8" />}
                                />

                                <View style={styles.roleContainer}>
                                    <Text variant="labelLarge" style={styles.roleLabel}>I am an / a</Text>
                                    <Menu
                                        visible={showRoleMenu}
                                        onDismiss={() => setShowRoleMenu(false)}
                                        anchor={
                                            <Button
                                                mode="outlined"
                                                onPress={() => setShowRoleMenu(true)}
                                                style={styles.roleButton}
                                                labelStyle={styles.roleButtonLabel}
                                                icon="chevron-down"
                                                contentStyle={{ flexDirection: 'row-reverse' }}
                                            >
                                                {selectedRole}
                                            </Button>
                                        }
                                        contentStyle={styles.menuContent}
                                    >
                                        {ROLES.map((role) => (
                                            <Menu.Item
                                                key={role}
                                                onPress={() => {
                                                    setSelectedRole(role);
                                                    setShowRoleMenu(false);
                                                }}
                                                title={role}
                                                titleStyle={{ fontSize: 14 }}
                                            />
                                        ))}
                                    </Menu>
                                </View>

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
        overflow: 'hidden',
    },
    cardInner: {
        paddingHorizontal: 20,
        paddingVertical: 18,
    },
    input: {
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.5)', // Brighter blending
    },
    roleContainer: {
        marginVertical: 12,
    },
    roleLabel: {
        color: '#64748B',
        marginBottom: 8,
        marginLeft: 4,
    },
    roleButton: {
        borderRadius: 12,
        borderColor: 'rgba(226, 232, 240, 0.8)',
        height: 50,
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    roleButtonLabel: {
        color: '#1E293B',
        fontSize: 15,
    },
    menuContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
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
