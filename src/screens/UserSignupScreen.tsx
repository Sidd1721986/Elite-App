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
import { formatAddress, validateAddressWithGoogle, AddressParts, US_STATES } from '../utils/addressUtils';
import { GOOGLE_PLACES_API_KEY } from '../config/env';
import AddressAutocomplete from '../components/AddressAutocomplete';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'UserSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const UserSignupScreen: React.FC<Props> = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
    const [roleOther, setRoleOther] = useState('');
    const [referralSource, setReferralSource] = useState('');

    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [showStateMenu, setShowStateMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [addressValidating, setAddressValidating] = useState(false);
    const [addressValid, setAddressValid] = useState<boolean | null>(null);
    const [addressSuggestion, setAddressSuggestion] = useState<string | undefined>();
    const [addressCorrectedParts, setAddressCorrectedParts] = useState<AddressParts | undefined>();
    const [agreeLegal, setAgreeLegal] = useState(false);
    const { signup } = useAuth();
    const signupTimeoutRef = React.useRef<any>(null);

    const nameRef = React.useRef<any>(null);
    const emailRef = React.useRef<any>(null);
    const phoneRef = React.useRef<any>(null);
    const passwordRef = React.useRef<any>(null);
    const confirmPasswordRef = React.useRef<any>(null);
    const roleOtherRef = React.useRef<any>(null);
    const referralSourceRef = React.useRef<any>(null);

    const handleAddressBlur = async () => {
        if (!street || !city || !zip || !state) { return; }
        // Already validated (e.g. picked from autocomplete) — don't re-validate
        if (addressValid === true) { return; }
        setAddressValidating(true);
        setAddressValid(null);
        setAddressSuggestion(undefined);
        setAddressCorrectedParts(undefined);
        const result = await validateAddressWithGoogle({ street, city, zip, state }, GOOGLE_PLACES_API_KEY);
        setAddressValid(result.valid);
        setAddressSuggestion(result.suggestion);
        setAddressCorrectedParts(result.correctedParts);
        setAddressValidating(false);
    };

    const applyAddressCorrection = () => {
        if (!addressCorrectedParts) { return; }
        setStreet(addressCorrectedParts.street);
        setCity(addressCorrectedParts.city);
        setState(addressCorrectedParts.state);
        setZip(addressCorrectedParts.zip);
        setAddressValid(true);
        setAddressCorrectedParts(undefined);
    };

    const handleSignup = async () => {
        setSubmitted(true);
        const address = formatAddress({ street, city, zip, state });

        if (!name || !email || !street || !city || !zip || !state || !phone || !password || !confirmPassword || !referralSource || (selectedRole === UserRole.OTHER && !roleOther)) {
            setSnackbarMessage('Please fill in all required fields');
            setSnackbarVisible(true);
            return;
        }

        // Validate address with Google if not already validated
        if (addressValid === null) {
            setAddressValidating(true);
            const result = await validateAddressWithGoogle({ street, city, zip, state }, GOOGLE_PLACES_API_KEY);
            setAddressValid(result.valid);
            setAddressSuggestion(result.suggestion);
            setAddressCorrectedParts(result.correctedParts);
            setAddressValidating(false);
            if (!result.valid) {
                setSnackbarMessage('Please enter a valid address');
                setSnackbarVisible(true);
                return;
            }
        } else if (addressValid === false) {
            setSnackbarMessage('Please enter a valid address');
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
            selectedRole,
            address,
            phone,
            referralSource,
            selectedRole === UserRole.OTHER ? roleOther : undefined
        );

        if (result === true) {
            setSnackbarMessage('User account created successfully!');
            setSnackbarVisible(true);
            signupTimeoutRef.current = setTimeout(() => {
                setLoading(false);
                navigation.navigate('Login');
            }, 2000);
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

    const customerRoles = [
        { label: 'Individual User', value: UserRole.CUSTOMER },
        { label: 'Realtor', value: UserRole.REALTOR },
        { label: 'Property manager', value: UserRole.PROPERTY_MANAGER },
        { label: 'Business', value: UserRole.BUSINESS },
        { label: 'Home Owner', value: UserRole.HOME_OWNER },
        { label: 'Landlord', value: UserRole.LANDLORD },
        { label: 'Other', value: UserRole.OTHER },
    ];

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
                                User Signup
                            </Text>
                            <Text variant="bodyLarge" style={styles.subtitle}>
                                Create your account to request services
                            </Text>

                            <Card style={styles.card}>
                                <Card.Content>
                                    <TextInput
                                        ref={nameRef}
                                        label={submitted && !name ? 'Full Name *' : 'Full Name'}
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => emailRef.current?.focus()}
                                        error={submitted && !name}
                                    />

                                    <AddressAutocomplete
                                        label={submitted && !street ? 'Street Address *' : 'Street Address'}
                                        hasError={submitted && !street}
                                        initialValue={street}
                                        onAddressSelect={({ street: s, city: c, zip: z, state: st }) => {
                                            setStreet(s);
                                            setCity(c);
                                            setZip(z);
                                            setState(st);
                                            // Address came from Google autocomplete — already validated
                                            setAddressValid(true);
                                            setAddressSuggestion(undefined);
                                            setAddressCorrectedParts(undefined);
                                        }}
                                    />
                                    <TextInput
                                        label={submitted && !city ? 'City *' : 'City'}
                                        value={city}
                                        onChangeText={(v) => { setCity(v); setAddressValid(null); }}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        error={submitted && !city}
                                    />
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <View style={{ flex: 1 }}>
                                            <Menu
                                                visible={showStateMenu}
                                                onDismiss={() => setShowStateMenu(false)}
                                                anchor={
                                                    <Button
                                                        mode="outlined"
                                                        onPress={() => setShowStateMenu(true)}
                                                        style={[styles.dropdownButton, submitted && !state && { borderColor: '#B00020' }]}
                                                        contentStyle={styles.dropdownButtonContent}
                                                        labelStyle={{ color: state ? '#1E293B' : '#94A3B8' }}
                                                    >
                                                        {state || (submitted && !state ? 'State *' : 'State')}
                                                    </Button>
                                                }
                                            >
                                                {US_STATES.map((s) => (
                                                    <Menu.Item
                                                        key={s}
                                                        title={s}
                                                        onPress={() => {
                                                            setState(s);
                                                            setAddressValid(null);
                                                            setShowStateMenu(false);
                                                        }}
                                                    />
                                                ))}
                                            </Menu>
                                            {submitted && !state && (
                                                <Text style={{ fontSize: 12, color: '#B00020', marginTop: 2 }}>State is required</Text>
                                            )}
                                        </View>
                                        <TextInput
                                            label={submitted && !zip ? 'Zip *' : 'Zip'}
                                            value={zip}
                                            onChangeText={(v) => { setZip(v); setAddressValid(null); }}
                                            onBlur={handleAddressBlur}
                                            mode="outlined"
                                            style={[styles.input, { flex: 1 }]}
                                            keyboardType="number-pad"
                                            returnKeyType="next"
                                            error={submitted && !zip}
                                        />
                                    </View>
                                    {addressValidating && (
                                        <Text style={{ fontSize: 12, color: '#6366F1', marginBottom: 8 }}>
                                            🔍 Validating address…
                                        </Text>
                                    )}
                                    {!addressValidating && addressValid === true && (
                                        <Text style={{ fontSize: 12, color: '#16A34A', marginBottom: 8 }}>
                                            ✓ Address verified
                                            {addressSuggestion ? `: ${addressSuggestion}` : ''}
                                        </Text>
                                    )}
                                    {!addressValidating && addressValid === false && (
                                        <View style={{ marginBottom: 8 }}>
                                            <Text style={{ fontSize: 12, color: '#B00020', marginBottom: 4 }}>
                                                ✗ Address not found — did you mean:
                                            </Text>
                                            {addressSuggestion && addressCorrectedParts ? (
                                                <TouchableOpacity
                                                    onPress={applyAddressCorrection}
                                                    style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 6, padding: 10 }}
                                                >
                                                    <Text style={{ fontSize: 13, color: '#1E293B', fontWeight: '500' }}>
                                                        {addressSuggestion}
                                                    </Text>
                                                    <Text style={{ fontSize: 11, color: '#6366F1', marginTop: 2 }}>
                                                        Tap to use this address
                                                    </Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <Text style={{ fontSize: 12, color: '#B00020' }}>
                                                    Please check street, city, state, and zip
                                                </Text>
                                            )}
                                        </View>
                                    )}

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
                                        onSubmitEditing={() => {
                                            if (selectedRole === UserRole.OTHER) {
                                                roleOtherRef.current?.focus();
                                            } else {
                                                referralSourceRef.current?.focus();
                                            }
                                        }}
                                        error={submitted && (!confirmPassword || password !== confirmPassword)}
                                    />

                                    <View style={styles.dropdownContainer}>
                                        <Text variant="labelLarge" style={styles.label}>
                                            Account Type
                                        </Text>
                                        <Menu
                                            visible={showRoleMenu}
                                            onDismiss={() => setShowRoleMenu(false)}
                                            anchor={
                                                <Button
                                                    mode="outlined"
                                                    onPress={() => setShowRoleMenu(true)}
                                                    style={styles.dropdownButton}
                                                    contentStyle={styles.dropdownButtonContent}
                                                >
                                                    {customerRoles.find(r => r.value === selectedRole)?.label || 'Select Type'}
                                                </Button>
                                            }>
                                            {customerRoles.map((role) => (
                                                <Menu.Item
                                                    key={role.value}
                                                    onPress={() => {
                                                        setSelectedRole(role.value);
                                                        setShowRoleMenu(false);
                                                    }}
                                                    title={role.label}
                                                />
                                            ))}
                                        </Menu>
                                    </View>

                                    {selectedRole === UserRole.OTHER && (
                                        <TextInput
                                            ref={roleOtherRef}
                                            label={submitted && !roleOther ? 'Please specify type *' : 'Please specify type'}
                                            value={roleOther}
                                            onChangeText={setRoleOther}
                                            mode="outlined"
                                            style={styles.input}
                                            returnKeyType="next"
                                            onSubmitEditing={() => referralSourceRef.current?.focus()}
                                            error={submitted && !roleOther}
                                        />
                                    )}

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
                                    >
                                        Create User Account
                                    </Button>

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
        overflow: 'visible',
    },
    input: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    formRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    label: {
        marginTop: 8,
        marginBottom: 8,
    },
    dropdownContainer: {
        marginBottom: 16,
    },
    dropdownButton: {
        marginTop: 4,
        borderColor: '#E2E8F0',
        borderRadius: 12,
    },
    dropdownButtonContent: {
        justifyContent: 'flex-start',
        height: 50,
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

export default UserSignupScreen;
