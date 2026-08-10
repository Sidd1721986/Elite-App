import * as React from 'react';
import { useState } from 'react';
import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card, Snackbar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import AppLogo from '../components/AppLogo';
import LegalConsentFooter from '../components/LegalConsentFooter';
import SocialAuthButtons from '../components/SocialAuthButtons';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'UserSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

// Minimal signup: name, email, password. Address and phone are collected later,
// where they're actually needed (posting a job / profile), instead of up front.
const UserSignupScreen: React.FC<Props> = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [agreeLegal, setAgreeLegal] = useState(false);
    const { signup } = useAuth();
    const signupTimeoutRef = React.useRef<any>(null);

    const emailRef = React.useRef<any>(null);
    const passwordRef = React.useRef<any>(null);

    const isEmailValid = (e: string) => e.includes('@');

    const showMessage = (msg: string) => {
        setSnackbarMessage(msg);
        setSnackbarVisible(true);
    };

    const handleSignup = async () => {
        setSubmitted(true);

        if (!name || !email || !password) {
            showMessage('Please fill in all required fields');
            return;
        }
        if (!isEmailValid(email)) {
            showMessage('The email should be in right format');
            return;
        }
        if (password.length < 8) {
            showMessage('Password must be at least 8 characters');
            return;
        }
        if (!agreeLegal) {
            showMessage('Please agree to the Terms of Service and Privacy Policy');
            return;
        }

        setLoading(true);
        const result = await signup(name, email, password, UserRole.CUSTOMER);

        if (result === true) {
            showMessage('Account created! Please log in.');
            signupTimeoutRef.current = setTimeout(() => {
                setLoading(false);
                navigation.navigate('Login', { initialRole: UserRole.CUSTOMER });
            }, 1500);
        } else {
            setLoading(false);
            showMessage(typeof result === 'string' ? result : 'Email already exists');
        }
    };

    React.useEffect(() => {
        return () => {
            if (signupTimeoutRef.current) {
                clearTimeout(signupTimeoutRef.current);
            }
        };
    }, []);

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
                >
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.content}>
                            <View style={styles.logoContainer}>
                                <AppLogo size={56} showSurface={false} />
                            </View>
                            <Text variant="displaySmall" style={styles.title}>
                                Create Account
                            </Text>
                            <Text variant="bodyLarge" style={styles.subtitle}>
                                Sign up in seconds to request services
                            </Text>

                            <Card style={styles.card}>
                                <Card.Content>
                                    <TextInput
                                        label={submitted && !name ? 'Full Name *' : 'Full Name'}
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => emailRef.current?.focus()}
                                        error={submitted && !name}
                                        testID="signup_name_input"
                                    />

                                    <TextInput
                                        ref={emailRef}
                                        label={submitted && (!email || !isEmailValid(email)) ? 'Email *' : 'Email'}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => passwordRef.current?.focus()}
                                        error={submitted && (!email || !isEmailValid(email))}
                                        testID="signup_email_input"
                                    />

                                    <TextInput
                                        ref={passwordRef}
                                        label={submitted && !password ? 'Password *' : 'Password'}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="done"
                                        onSubmitEditing={handleSignup}
                                        error={submitted && !password}
                                        right={
                                            <TextInput.Icon
                                                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                                color="#94A3B8"
                                                onPress={() => setShowPassword(prev => !prev)}
                                            />
                                        }
                                        testID="signup_password_input"
                                    />

                                    <LegalConsentFooter
                                        agreed={agreeLegal}
                                        onAgreedChange={setAgreeLegal}
                                        onPrivacyPress={() => navigation.navigate('PrivacyPolicy')}
                                        onTermsPress={() => navigation.navigate('TermsOfService')}
                                    />

                                    <Button
                                        mode="contained"
                                        onPress={handleSignup}
                                        loading={loading}
                                        disabled={loading}
                                        style={styles.signupButton}
                                        testID="signup_submit_btn"
                                    >
                                        Create Account
                                    </Button>

                                    <SocialAuthButtons role={UserRole.CUSTOMER} onMessage={showMessage} />

                                    <Button
                                        mode="text"
                                        onPress={() => navigation.navigate('Login', { initialRole: UserRole.CUSTOMER })}
                                        style={styles.backButton}
                                    >
                                        Already have an account? Log In
                                    </Button>
                                </Card.Content>
                            </Card>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>

                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={() => setSnackbarVisible(false)}
                    duration={3000}
                >
                    {snackbarMessage}
                </Snackbar>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingVertical: 24,
        paddingBottom: 40,
    },
    content: {},
    title: {
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: '900',
        color: '#1E293B',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 12,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 20,
        opacity: 0.8,
        color: '#64748B',
    },
    card: {
        marginTop: 16,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        overflow: 'visible',
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    signupButton: {
        marginTop: 16,
        paddingVertical: 8,
        borderRadius: 14,
    },
    backButton: {
        marginTop: 12,
    },
});

export default UserSignupScreen;
