import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, Snackbar } from 'react-native-paper';
import { CommonActions, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../services/authService';

type Nav = StackNavigationProp<RootStackParamList, 'ResetPassword'>;
type R = RouteProp<RootStackParamList, 'ResetPassword'>;

const ResetPasswordScreen: React.FC = () => {
    const navigation = useNavigation<Nav>();
    const route = useRoute<R>();
    const { email, resetToken: initialToken } = route.params;

    const [token, setToken] = useState(initialToken ?? '');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const handleSubmit = useCallback(async () => {
        if (!token.trim()) {
            setSnackbarMessage('Enter the reset code');
            setSnackbarVisible(true);
            return;
        }
        if (password.length < 6) {
            setSnackbarMessage('Password must be at least 6 characters');
            setSnackbarVisible(true);
            return;
        }
        if (password !== confirm) {
            setSnackbarMessage('Passwords do not match');
            setSnackbarVisible(true);
            return;
        }

        setLoading(true);
        const result = await authService.resetPassword(email, token, password);
        setLoading(false);

        if (!result.ok) {
            setSnackbarMessage(result.message || 'Could not reset password');
            setSnackbarVisible(true);
            return;
        }

        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login', params: { passwordResetOk: true } }],
            }),
        );
    }, [email, token, password, confirm, navigation]);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Text variant="headlineSmall" style={styles.title}>
                        Choose new password
                    </Text>
                    <Text variant="bodyMedium" style={styles.subtitle}>
                        Identity verified for <Text style={styles.emailEm}>{email}</Text>. Please choose your new password below.
                    </Text>

                    <Card style={styles.card} elevation={0}>
                        <Card.Content style={styles.cardInner}>
                            <TextInput
                                label="New password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                mode="outlined"
                                style={styles.input}
                                outlineColor="#E2E8F0"
                                activeOutlineColor="#6366F1"
                                left={<TextInput.Icon icon="lock-outline" color="#94A3B8" />}
                            />
                            <TextInput
                                label="Confirm password"
                                value={confirm}
                                onChangeText={setConfirm}
                                secureTextEntry
                                mode="outlined"
                                style={styles.input}
                                outlineColor="#E2E8F0"
                                activeOutlineColor="#6366F1"
                                left={<TextInput.Icon icon="lock-check-outline" color="#94A3B8" />}
                            />

                            <Button
                                mode="contained"
                                onPress={handleSubmit}
                                loading={loading}
                                disabled={loading}
                                style={styles.primaryBtn}
                                contentStyle={styles.primaryBtnContent}
                            >
                                Update password
                            </Button>

                            <Button mode="text" onPress={() => navigation.goBack()} textColor="#64748B">
                                Back
                            </Button>
                        </Card.Content>
                    </Card>
                </ScrollView>

                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={() => setSnackbarVisible(false)}
                    duration={4000}
                    style={styles.snackbar}
                >
                    {snackbarMessage}
                </Snackbar>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, padding: 24, paddingTop: 24 },
    title: { fontWeight: '800', color: '#0F172A', textAlign: 'center' },
    subtitle: { color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 22, marginBottom: 24 },
    emailEm: { fontWeight: '700', color: '#475569' },
    card: {
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.9)',
    },
    cardInner: { paddingVertical: 8 },
    input: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.6)' },
    primaryBtn: { marginTop: 12, borderRadius: 12, backgroundColor: '#6366F1' },
    primaryBtnContent: { height: 52 },
    snackbar: { backgroundColor: '#1E293B', borderRadius: 12 },
});

export default React.memo(ResetPasswordScreen);
