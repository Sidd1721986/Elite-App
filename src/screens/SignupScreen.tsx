import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { TextInput, Button, Text, Card, SegmentedButtons, Snackbar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Signup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const { signup } = useAuth();

    const handleSignup = async () => {
        if (!username || !email || !password || !confirmPassword) {
            setSnackbarMessage('Please fill in all fields');
            setSnackbarVisible(true);
            return;
        }

        if (password !== confirmPassword) {
            setSnackbarMessage('Passwords do not match');
            setSnackbarVisible(true);
            return;
        }

        if (password.length < 6) {
            setSnackbarMessage('Password must be at least 6 characters');
            setSnackbarVisible(true);
            return;
        }

        setLoading(true);
        const success = await signup(username, email, password, selectedRole);
        setLoading(false);

        if (success) {
            setSnackbarMessage('Account created successfully!');
            setSnackbarVisible(true);
            setTimeout(() => navigation.navigate('Login'), 2000);
        } else {
            setSnackbarMessage('Email already exists');
            setSnackbarVisible(true);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
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
                                label="Username"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="words"
                                mode="outlined"
                                style={styles.input}
                            />

                            <TextInput
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoComplete="email"
                                mode="outlined"
                                style={styles.input}
                            />

                            <TextInput
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                mode="outlined"
                                style={styles.input}
                            />

                            <TextInput
                                label="Confirm Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                mode="outlined"
                                style={styles.input}
                            />

                            <Text variant="labelLarge" style={styles.label}>
                                Select Role
                            </Text>
                            <SegmentedButtons
                                value={selectedRole}
                                onValueChange={(value) => setSelectedRole(value as UserRole)}
                                buttons={[
                                    { value: UserRole.ADMIN, label: 'Admin' },
                                    { value: UserRole.VENDOR, label: 'Vendor' },
                                    { value: UserRole.CUSTOMER, label: 'Customer' },
                                ]}
                                style={styles.segmentedButtons}
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

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
            >
                {snackbarMessage}
            </Snackbar>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
        fontWeight: 'bold',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 20,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 32,
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
        marginBottom: 12,
    },
    segmentedButtons: {
        marginBottom: 24,
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
