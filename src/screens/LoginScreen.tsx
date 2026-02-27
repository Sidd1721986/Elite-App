import * as React from 'react';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { TextInput, Button, Text, Card, Snackbar, Menu, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const { login } = useAuth();

    const handleLogin = async () => {
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
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.decoratorCircle} />
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
                            <Surface style={styles.logoSurface} elevation={2}>
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </Surface>
                            <Text variant="displayMedium" style={styles.brandTitle}>
                                Elite Services
                            </Text>
                            <Text variant="bodyLarge" style={styles.brandSubtitle}>
                                Premium Services. Seamless Experience.
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
                                        {[UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER].map((role) => (
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
                                        onPress={() => navigation.navigate('SignupRoleSelector')}
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
                    onDismiss={() => setSnackbarVisible(false)}
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
        backgroundColor: '#F8FAFC',
    },
    decoratorCircle: {
        position: 'absolute',
        top: -100,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: 150,
        backgroundColor: '#6366F110',
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
    logoSurface: {
        width: 100,
        height: 100,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 60,
        height: 60,
    },
    brandTitle: {
        color: '#1E293B',
        fontWeight: '900',
        letterSpacing: -1,
    },
    brandSubtitle: {
        color: '#64748B',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardInner: {
        padding: 8,
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
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
        borderColor: '#E2E8F0',
        height: 50,
        justifyContent: 'center',
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

export default LoginScreen;
