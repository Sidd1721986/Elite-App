import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { UserRole } from '../types/types';
import { useAuth } from '../context/AuthContext';
import { isAppleAvailable, isGoogleAvailable } from '../services/socialAuth';

interface Props {
    /** Account type used if this Apple/Google identity has no account yet. */
    role: UserRole;
    /** Called with a user-facing message on failure or pending vendor approval. */
    onMessage: (message: string) => void;
}

/**
 * "Continue with Apple / Google" buttons shared by the login and signup screens.
 * Renders nothing when neither provider is available (Google unconfigured,
 * Apple on Android). On success AuthContext.socialLogin sets the user and the
 * navigator swaps to the signed-in stack — no navigation needed here.
 */
const SocialAuthButtons: React.FC<Props> = ({ role, onMessage }) => {
    const { socialLogin } = useAuth();
    const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

    const apple = isAppleAvailable();
    const google = isGoogleAvailable();

    const handlePress = useCallback(async (provider: 'apple' | 'google') => {
        setBusy(provider);
        try {
            const result = await socialLogin(provider, role);
            if (!result.ok && !result.cancelled) {
                onMessage(result.message || 'Sign-in failed. Please try again.');
            }
        } finally {
            setBusy(null);
        }
    }, [socialLogin, role, onMessage]);

    if (!apple && !google) { return null; }

    return (
        <View style={styles.container}>
            <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
            </View>

            {apple && (
                <Button
                    mode="contained"
                    icon="apple"
                    onPress={() => handlePress('apple')}
                    loading={busy === 'apple'}
                    disabled={busy !== null}
                    style={styles.appleButton}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.appleLabel}
                    testID="social_apple_btn"
                >
                    Continue with Apple
                </Button>
            )}

            {google && (
                <Button
                    mode="outlined"
                    icon="google"
                    onPress={() => handlePress('google')}
                    loading={busy === 'google'}
                    disabled={busy !== null}
                    style={styles.googleButton}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.googleLabel}
                    testID="social_google_btn"
                >
                    Continue with Google
                </Button>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 16,
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    appleButton: {
        borderRadius: 12,
        backgroundColor: '#000000',
        marginBottom: 10,
    },
    appleLabel: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    googleButton: {
        borderRadius: 12,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    googleLabel: {
        color: '#1E293B',
        fontSize: 15,
        fontWeight: '600',
    },
    buttonContent: {
        height: 50,
    },
});

export default React.memo(SocialAuthButtons);
