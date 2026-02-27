import * as React from 'react';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card, Snackbar, Divider } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VendorSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const VendorSignupScreen: React.FC<Props> = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralSource, setReferralSource] = useState('');

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
    const referralSourceRef = React.useRef<any>(null);

    const handleSignup = async () => {
        setSubmitted(true);
        if (!name || !email || !address || !phone || !password || !confirmPassword || !referralSource) {
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
            setTimeout(() => {
                setLoading(false);
                navigation.navigate('Login');
            }, 3000);
        } else {
            setLoading(false);
            setSnackbarMessage(typeof result === 'string' ? result : 'Email already exists');
            setSnackbarVisible(true);
        }
    };

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
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
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
                                        label={submitted && !name ? "Company Name *" : "Company Name"}
                                        value={name}
                                        onChangeText={setName}
                                        autoCapitalize="words"
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => addressRef.current?.focus()}
                                        error={submitted && !name}
                                    />

                                    <TextInput
                                        ref={addressRef}
                                        label={submitted && !address ? "Business Address *" : "Business Address"}
                                        value={address}
                                        onChangeText={setAddress}
                                        mode="outlined"
                                        style={styles.input}
                                        returnKeyType="next"
                                        onSubmitEditing={() => emailRef.current?.focus()}
                                        error={submitted && !address}
                                    />

                                    <TextInput
                                        ref={emailRef}
                                        label={submitted && (!email || !isEmailValid(email)) ? "Business Email *" : "Business Email"}
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
                                        label={submitted && (!phone || !isPhoneValid(phone)) ? "Phone Number *" : "Phone Number"}
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
                                        label={submitted && !password ? "Password *" : "Password"}
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
                                        label={submitted && (!confirmPassword || password !== confirmPassword) ? "Confirm Password *" : "Confirm Password"}
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
                                        buttonColor="#F57C00"
                                    >
                                        Register as Vendor
                                    </Button>

                                    <Button
                                        mode="text"
                                        onPress={() => navigation.navigate('SignupRoleSelector')}
                                        style={styles.backButton}
                                    >
                                        Back to Role Selection
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
    divider: {
        marginVertical: 16,
    },
    signupButton: {
        marginTop: 16,
        paddingVertical: 6,
    },
    backButton: {
        marginTop: 8,
    },
});

export default VendorSignupScreen;
