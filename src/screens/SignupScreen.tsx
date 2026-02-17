import * as React from 'react';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card, Snackbar, Menu } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
    const [roleOther, setRoleOther] = useState('');
    const [referralSource, setReferralSource] = useState('');

    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const { signup } = useAuth();

    const nameRef = React.useRef<any>(null);
    const addressRef = React.useRef<any>(null);
    const emailRef = React.useRef<any>(null);
    const phoneRef = React.useRef<any>(null);
    const passwordRef = React.useRef<any>(null);
    const confirmPasswordRef = React.useRef<any>(null);
    const roleOtherRef = React.useRef<any>(null);
    const referralSourceRef = React.useRef<any>(null);

    const handleSignup = async () => {
        setSubmitted(true);
        if (!name || !email || !address || !phone || !password || !confirmPassword || !referralSource || (selectedRole === UserRole.OTHER && !roleOther)) {
            setSnackbarMessage('Please fill in all required fields');
            setSnackbarVisible(true);
            return;
        }

        const emailRegex = /\S+@\S+\.\S+/;
        if (!email.includes('@')) {
            setSnackbarMessage('the email should be in right format');
            setSnackbarVisible(true);
            return;
        }

        const phoneRegex = /^\d{10}$/;
        if (!phoneRegex.test(phone)) {
            setSnackbarMessage('the phone number is not correct');
            setSnackbarVisible(true);
            return;
        }

        if (password !== confirmPassword) {
            setSnackbarMessage('Passwords do not match');
            setSnackbarVisible(true);
            return;
        }

        setLoading(true);
        const success = await signup(
            name,
            email,
            password,
            selectedRole,
            address,
            phone,
            referralSource,
            selectedRole === UserRole.OTHER ? roleOther : undefined
        );

        if (success) {
            setSnackbarMessage('Account created successfully!');
            setSnackbarVisible(true);
            setTimeout(() => {
                setLoading(false);
                navigation.navigate('Login');
            }, 2000);
        } else {
            setLoading(false);
            setSnackbarMessage('Email already exists');
            setSnackbarVisible(true);
        }
    };

    const roles = [
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
                        showsVerticalScrollIndicator={true}
                    >
                        <View style={styles.content}>
                            <View style={styles.logoContainer}>
                                <Image
                                    source={require('../../assets/logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text variant="displaySmall" style={styles.title}>
                                Create Account
                            </Text>
                            <Text variant="bodyLarge" style={styles.subtitle}>
                                Sign up to get started
                            </Text>

                            <Card style={styles.card}>
                                <Card.Content>
                                    <TextInput
                                        ref={nameRef}
                                        label={submitted && !name ? "Name *" : "Name"}
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => addressRef.current?.focus()}
                                        blurOnSubmit={false}
                                        error={submitted && !name}
                                    />

                                    <TextInput
                                        ref={addressRef}
                                        label={submitted && !address ? "Address *" : "Address"}
                                        value={address}
                                        onChangeText={setAddress}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => emailRef.current?.focus()}
                                        blurOnSubmit={false}
                                        error={submitted && !address}
                                    />

                                    <TextInput
                                        ref={emailRef}
                                        label={submitted && (!email || !isEmailValid(email)) ? "Email *" : "Email"}
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => phoneRef.current?.focus()}
                                        blurOnSubmit={false}
                                        error={submitted && (!email || !isEmailValid(email))}
                                    />

                                    <TextInput
                                        ref={phoneRef}
                                        label={submitted && (!phone || !isPhoneValid(phone)) ? "Phone *" : "Phone"}
                                        placeholder="Phone (2fa confirmation ?)"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'phone-pad'}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => passwordRef.current?.focus()}
                                        blurOnSubmit={false}
                                        error={submitted && (!phone || !isPhoneValid(phone))}
                                    />

                                    <TextInput
                                        ref={passwordRef}
                                        label={submitted && !password ? "Password *" : "Password"}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                                        blurOnSubmit={false}
                                        error={submitted && !password}
                                    />

                                    <TextInput
                                        ref={confirmPasswordRef}
                                        label={submitted && (!confirmPassword || password !== confirmPassword) ? "Confirm Password *" : "Confirm Password"}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                        autoCapitalize="none"
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
                                        blurOnSubmit={false}
                                        error={submitted && (!confirmPassword || password !== confirmPassword)}
                                    />

                                    <View style={styles.dropdownContainer}>
                                        <Text variant="labelLarge" style={[styles.label, submitted && !selectedRole && { color: '#B00020' }]}>
                                            I am a {submitted && !selectedRole && "*"}
                                        </Text>
                                        <Menu
                                            visible={showRoleMenu}
                                            onDismiss={() => setShowRoleMenu(false)}
                                            anchor={
                                                <Button
                                                    mode="outlined"
                                                    onPress={() => setShowRoleMenu(true)}
                                                    style={[styles.dropdownButton, submitted && !selectedRole && { borderColor: '#B00020' }]}
                                                    contentStyle={styles.dropdownButtonContent}
                                                    textColor={submitted && !selectedRole ? '#B00020' : undefined}
                                                >
                                                    {roles.find(r => r.value === selectedRole)?.label || 'Select Role'}
                                                </Button>
                                            }>
                                            {roles.map((role) => (
                                                <Menu.Item
                                                    key={role.value}
                                                    onPress={() => {
                                                        setSelectedRole(role.value);
                                                        setShowRoleMenu(false);
                                                        // After selecting role, focus on either roleOther or referralSource
                                                        setTimeout(() => {
                                                            if (role.value === UserRole.OTHER) {
                                                                roleOtherRef.current?.focus();
                                                            } else {
                                                                referralSourceRef.current?.focus();
                                                            }
                                                        }, 100);
                                                    }}
                                                    title={role.label}
                                                />
                                            ))}
                                        </Menu>
                                    </View>

                                    {selectedRole === UserRole.OTHER && (
                                        <TextInput
                                            ref={roleOtherRef}
                                            label={submitted && !roleOther ? "Please specify *" : "Please specify"}
                                            value={roleOther}
                                            onChangeText={setRoleOther}
                                            mode="outlined"
                                            style={styles.input}
                                            returnKeyType="next"
                                            onSubmitEditing={() => referralSourceRef.current?.focus()}
                                            blurOnSubmit={false}
                                            error={submitted && !roleOther}
                                        />
                                    )}

                                    <TextInput
                                        ref={referralSourceRef}
                                        label={submitted && !referralSource ? "How did you hear about us? *" : "How did you hear about us?"}
                                        value={referralSource}
                                        onChangeText={setReferralSource}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="done"
                                        onSubmitEditing={handleSignup}
                                        error={submitted && !referralSource}
                                    />

                                    <Button
                                        mode="contained"
                                        onPress={handleSignup}
                                        loading={loading}
                                        disabled={loading}
                                        style={styles.signupButton}
                                    >
                                        Sign Up
                                    </Button>

                                    <Button
                                        mode="text"
                                        onPress={() => navigation.navigate('Login')}
                                        style={styles.loginButton}
                                    >
                                        Already have an account? Login
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
        backgroundColor: '#f5f5f5',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 16,
        paddingBottom: 40,
    },
    content: {
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: 'bold',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 10,
    },
    logo: {
        width: 60,
        height: 60,
        borderRadius: 12,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 16,
        opacity: 0.7,
    },
    card: {
        marginTop: 16,
    },
    input: {
        marginBottom: 16,
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
        borderColor: '#757575',
    },
    dropdownButtonContent: {
        justifyContent: 'flex-start',
        height: 50,
    },
    signupButton: {
        marginTop: 16,
        paddingVertical: 6,
    },
    loginButton: {
        marginTop: 8,
    },
});

export default SignupScreen;
