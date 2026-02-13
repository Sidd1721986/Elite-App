import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { TextInput, Button, Text, Card, SegmentedButtons, Snackbar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

interface Props {
    navigation: LoginScreenNavigationProp;
}

const LoginScreen: React.FC<Props> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CUSTOMER);
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
        const success = await login(email, password, selectedRole);
        setLoading(false);

        if (!success) {
            setSnackbarMessage('Invalid credentials or wrong role selected');
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
                        Welcome Back
                    </Text>
                    <Text variant="bodyLarge" style={styles.subtitle}>
                        Sign in to continue
                    </Text>

                    <Card style={styles.card}>
                        <Card.Content>
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
                                onPress={handleLogin}
                                loading={loading}
                                disabled={loading}
                                style={styles.loginButton}
                            >
                                Login
                            </Button>

                            <Button
                                mode="text"
                                onPress={() => navigation.navigate('Signup')}
                                style={styles.signupButton}
                            >
                                Don't have an account? Sign Up
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
        width: 120,
        height: 120,
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
    loginButton: {
        marginTop: 16,
        paddingVertical: 6,
    },
    signupButton: {
        marginTop: 8,
    },
});

export default LoginScreen;
