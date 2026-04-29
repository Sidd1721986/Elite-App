import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../services/apiClient';

export default function InviteAdminScreen() {
    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [snack, setSnack] = useState<{ message: string; error: boolean } | null>(null);

    const handleSend = async () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setSnack({ message: 'Please enter a valid email address.', error: true });
            return;
        }

        setLoading(true);
        try {
            const res = await apiClient.post<{ message: string }>('/admin/invite', { email: trimmed });
            setEmail('');
            setSnack({ message: res.message, error: false });
        } catch (err: any) {
            setSnack({ message: err.message ?? 'Failed to send invite.', error: true });
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
                    <Text variant="headlineMedium" style={styles.title}>Invite Admin</Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Enter the email address of the person you want to invite as an Admin.
                        They'll receive a secure link valid for 48 hours.
                    </Text>

                    <TextInput
                        label="Email address"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon="email-outline" />}
                    />

                    <Button
                        mode="contained"
                        onPress={handleSend}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                        contentStyle={styles.buttonContent}>
                        Send Invite
                    </Button>

                    <Button
                        mode="text"
                        onPress={() => navigation.goBack()}
                        style={styles.back}>
                        Back
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
    input: { marginBottom: 20 },
    button: { borderRadius: 10 },
    buttonContent: { paddingVertical: 6 },
    back: { marginTop: 8 },
    snackError: { backgroundColor: '#DC2626' },
    snackSuccess: { backgroundColor: '#059669' },
});
