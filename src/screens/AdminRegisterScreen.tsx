import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { apiClient } from '../services/apiClient';

type RouteProps = RouteProp<RootStackParamList, 'AdminRegister'>;
type NavProps = StackNavigationProp<RootStackParamList>;

export default function AdminRegisterScreen() {
    const navigation = useNavigation<NavProps>();
    const route = useRoute<RouteProps>();
    const { token, email } = route.params;

    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snack, setSnack] = useState<{ message: string; error: boolean } | null>(null);

    const handleRegister = async () => {
        if (!name.trim()) {
            setSnack({ message: 'Please enter your full name.', error: true });
            return;
        }
        if (password.length < 8) {
            setSnack({ message: 'Password must be at least 8 characters.', error: true });
            return;
        }
        if (password !== confirmPassword) {
            setSnack({ message: 'Passwords do not match.', error: true });
            return;
        }

        setLoading(true);
        try {
            await apiClient.post<{ message: string }>('/auth/admin-register', {
                token,
                email,
                name: name.trim(),
                password,
            });
            setSnack({ message: 'Account created! You can now log in.', error: false });
            setTimeout(() => {
                navigation.reset({ index: 0, routes: [{ name: 'Login', params: { initialRole: 'Admin' as any } }] });
            }, 1500);
        } catch (err: any) {
            setSnack({ message: err.message ?? 'Registration failed. The invite may have expired.', error: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled">
                    <Text variant="headlineMedium" style={styles.title}>Create Admin Account</Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        You've been invited as an Admin. Set your name and password to get started.
                    </Text>

                    <TextInput
                        label="Email"
                        value={email}
                        editable={false}
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon="email-outline" />}
                        theme={{ colors: { onSurfaceDisabled: '#444' } }}
                    />

                    <TextInput
                        label="Full name"
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        autoCorrect={false}
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon="account-outline" />}
                    />

                    <TextInput
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon="lock-outline" />}
                        right={
                            <TextInput.Icon
                                icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                onPress={() => setShowPassword(v => !v)}
                            />
                        }
                    />

                    <TextInput
                        label="Confirm password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon="lock-check-outline" />}
                    />

                    <Button
                        mode="contained"
                        onPress={handleRegister}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                        contentStyle={styles.buttonContent}>
                        Create Account
                    </Button>
                </ScrollView>
            </KeyboardAvoidingView>

            <Snackbar
                visible={!!snack}
                onDismiss={() => setSnack(null)}
                duration={4000}
                style={snack?.error ? styles.snackError : styles.snackSuccess}>
                {snack?.message ?? ''}
            </Snackbar>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },
    flex: { flex: 1 },
    container: { padding: 24, paddingTop: 40 },
    title: { fontWeight: '700', marginBottom: 10, color: '#111' },
    subtitle: { color: '#555', marginBottom: 28, lineHeight: 22 },
    input: { marginBottom: 16 },
    button: { borderRadius: 10, marginTop: 8 },
    buttonContent: { paddingVertical: 6 },
    snackError: { backgroundColor: '#DC2626' },
    snackSuccess: { backgroundColor: '#059669' },
});
