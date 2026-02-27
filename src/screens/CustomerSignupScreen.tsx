import * as React from 'react';
import { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextInput, Button, Text, Card, Snackbar, Menu } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CustomerSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const CustomerSignupScreen: React.FC<Props> = ({ navigation }) => {
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
            selectedRole,
            address,
            phone,
            referralSource,
            selectedRole === UserRole.OTHER ? roleOther : undefined
        );

        if (result === true) {
            setSnackbarMessage('Customer account created successfully!');
            setSnackbarVisible(true);
            setTimeout(() => {
                setLoading(false);
                navigation.navigate('Login');
            }, 2000);
        } else {
            setLoading(false);
            setSnackbarMessage(typeof result === 'string' ? result : 'Email already exists');
            setSnackbarVisible(true);
        }
    };

    const customerRoles = [
        { label: 'Individual Customer', value: UserRole.CUSTOMER },
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
                                <Image
                                    source={require('../assets/logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text variant="displaySmall" style={styles.title}>
                                Customer Signup
                            </Text>
                            <Text variant="bodyLarge" style={styles.subtitle}>
                                Create your account to request services
                            </Text>

                            <Card style={styles.card}>
                                <Card.Content>
                                    <TextInput
                                        ref={nameRef}
                                        label={submitted && !name ? "Full Name *" : "Full Name"}
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
                                        label={submitted && !address ? "Address *" : "Address"}
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
                                        label={submitted && (!email || !isEmailValid(email)) ? "Email *" : "Email"}
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
                                            label={submitted && !roleOther ? "Please specify type *" : "Please specify type"}
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
                                        Create Customer Account
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
    backButton: {
        marginTop: 8,
    },
});

export default CustomerSignupScreen;
