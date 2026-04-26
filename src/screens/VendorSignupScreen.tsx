import * as React from 'react';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card, Snackbar, Divider, Menu } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import AppLogo from '../components/AppLogo';
import LegalConsentFooter from '../components/LegalConsentFooter';
import { formatAddress, US_STATES } from '../utils/addressUtils';


type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VendorSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const VendorSignupScreen: React.FC<Props> = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralSource, setReferralSource] = useState('');
    const [showStateMenu, setShowStateMenu] = useState(false);

    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [agreeLegal, setAgreeLegal] = useState(false);
    const { signup } = useAuth();
    const signupTimeoutRef = React.useRef<any>(null);

    const nameRef = React.useRef<any>(null);
    const streetRef = React.useRef<any>(null);
    const cityRef = React.useRef<any>(null);
    const zipRef = React.useRef<any>(null);
    const stateRef = React.useRef<any>(null);
    const emailRef = React.useRef<any>(null);
    const phoneRef = React.useRef<any>(null);
    const passwordRef = React.useRef<any>(null);
    const confirmPasswordRef = React.useRef<any>(null);
    const referralSourceRef = React.useRef<any>(null);

    const handleSignup = async () => {
        setSubmitted(true);
        const address = formatAddress({ street, city, zip, state });

        if (!name || !email || !street || !city || !zip || !state || !phone || !password || !confirmPassword || !referralSource) {
            setSnackbarMessage('Please fill in all required fields');
            setSnackbarVisible(true);
            return;
        }

        if (!email.includes('@')) {
            setSnackbarMessage('The email should be in right format');
            setSnackbarVisible(true);
            return;
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            setSnackbarMessage('The phone number is not correct');
            setSnackbarVisible(true);
            return;
        }

        if (password !== confirmPassword) {
            setSnackbarMessage('Passwords do not match');
            setSnackbarVisible(true);
            return;
        }

        if (!agreeLegal) {
            setSnackbarMessage('Please agree to the Terms of Service and Privacy Policy');
            setSnackbarVisible(true);
            return;
        }

        setLoading(true);
        const result = await signup(
            name,
            email,
            password,
            UserRole.VENDOR,
            address,
            phone,
            referralSource
        );

        if (result === true) {
            setSnackbarMessage('Account created! Please wait for Admin approval.');
            setSnackbarVisible(true);
            signupTimeoutRef.current = setTimeout(() => {
                setLoading(false);
                navigation.navigate('Login');
            }, 3000);
        } else {
            setLoading(false);
            setSnackbarMessage(typeof result === 'string' ? result : 'Email already exists');
            setSnackbarVisible(true);
        }
    };

    React.useEffect(() => {
        return () => {
            if (signupTimeoutRef.current) {
                clearTimeout(signupTimeoutRef.current);
            }
        };
    }, []);

    const isEmailValid = (e: string) => e.includes('@');
    const isPhoneValid = (p: string) => /^\d{10}$/.test(p);

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
                                Vendor Signup
                            </Text>
                            <Text variant="bodyLarge" style={styles.subtitle}>
                                Join our network of professional service providers
                            </Text>

                            <Card style={styles.card}>
                                <Card.Content>
                                    <TextInput
                                        ref={nameRef}
                                        label={submitted && !name ? 'Company Name *' : 'Company Name'}
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => streetRef.current?.focus()}
                                        error={submitted && !name}
                                    />

                                    <TextInput
                                        ref={streetRef}
                                        label={submitted && !street ? 'Business Street Address *' : 'Business Street Address'}
                                        value={street}
                                        onChangeText={setStreet}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => cityRef.current?.focus()}
                                        error={submitted && !street}
                                    />

                                    <View style={styles.formRow}>
                                        <TextInput
                                            ref={cityRef}
                                            label={submitted && !city ? 'City *' : 'City'}
                                            value={city}
                                            onChangeText={setCity}
                                            mode="outlined"
                                            style={[styles.input, { flex: 2, marginRight: 8 }]}
                                            returnKeyType="next"
                                            onSubmitEditing={() => zipRef.current?.focus()}
                                            error={submitted && !city}
                                        />
                                        <TextInput
                                            ref={zipRef}
                                            label={submitted && !zip ? 'Zip *' : 'Zip'}
                                            value={zip}
                                            onChangeText={setZip}
                                            mode="outlined"
                                            style={[styles.input, { flex: 1.2, marginRight: 8 }]}
                                            keyboardType="numeric"
                                            returnKeyType="next"
                                            onSubmitEditing={() => stateRef.current?.focus()}
                                            error={submitted && !zip}
                                        />
                                        <Menu
                                            visible={showStateMenu}
                                            onDismiss={() => setShowStateMenu(false)}
                                            anchor={
                                                <TouchableOpacity
                                                    onPress={() => setShowStateMenu(true)}
                                                    activeOpacity={1}
                                                    style={{ flex: 1.2 }}
                                                >
                                                    <View pointerEvents="none">
                                                        <TextInput
                                                            ref={stateRef}
                                                            label={submitted && !state ? 'State *' : 'State'}
                                                            value={state}
                                                            mode="outlined"
                                                            style={styles.input}
                                                            right={<TextInput.Icon icon="chevron-down" />}
                                                            error={submitted && !state}
                                                            editable={false}
                                                        />
                                                    </View>
                                                </TouchableOpacity>
                                            }
                                        >
                                            <ScrollView style={{ maxHeight: 250 }}>
                                                {US_STATES.map((s) => (
                                                    <Menu.Item
                                                        key={s}
                                                        onPress={() => {
                                                            setState(s);
                                                            setShowStateMenu(false);
                                                            emailRef.current?.focus();
                                                        }}
                                                        title={s}
                                                    />
                                                ))}
                                            </ScrollView>
                                        </Menu>
                                    </View>

                                    <TextInput
                                        ref={emailRef}
                                        label={submitted && (!email || !isEmailValid(email)) ? 'Business Email *' : 'Business Email'}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => phoneRef.current?.focus()}
                                        error={submitted && (!email || !isEmailValid(email))}
                                    />

                                    <TextInput
                                        ref={phoneRef}
                                        label={submitted && (!phone || !isPhoneValid(phone)) ? 'Phone Number *' : 'Phone Number'}
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => passwordRef.current?.focus()}
                                        error={submitted && (!phone || !isPhoneValid(phone))}
                                    />

                                    <Divider style={styles.divider} />

                                    <TextInput
                                        ref={passwordRef}
                                        label={submitted && !password ? 'Password *' : 'Password'}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                        error={submitted && !password}
                                    />

                                    <TextInput
                                        ref={confirmPasswordRef}
                                        label={submitted && (!confirmPassword || password !== confirmPassword) ? 'Confirm Password *' : 'Confirm Password'}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => referralSourceRef.current?.focus()}
                                        error={submitted && (!confirmPassword || password !== confirmPassword)}
                                    />

                                    <TextInput
                                        ref={referralSourceRef}
                                        label={submitted && !referralSource ? 'How did you hear about us? *' : 'How did you hear about us?'}
                                        value={referralSource}
                                        onChangeText={setReferralSource}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="done"
                                        onSubmitEditing={handleSignup}
                                        error={submitted && !referralSource}
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
                                        buttonColor="#F57C00"
                                    >
                                        Register as Vendor
                                    </Button>

                                    <Button
                                        mode="text"
                                        onPress={() => navigation.navigate('Login', { initialRole: UserRole.VENDOR })}
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
    logo: {
        width: 72,
        height: 72,
        borderRadius: 16,
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
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    formRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    divider: {
        marginVertical: 16,
    },
    signupButton: {
        marginTop: 16,
        paddingVertical: 8,
        borderRadius: 14,
    },
    backButton: {
        marginTop: 8,
    },
});

export default VendorSignupScreen;
