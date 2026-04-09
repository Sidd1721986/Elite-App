import * as React from 'react';
import { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Card, Snackbar, Menu } from 'react-native-paper';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, UserRole } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppLogo from '../components/AppLogo';
import { authService, toApiRole } from '../services/authService';

const ROLES: UserRole[] = [UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER];

type Nav = StackNavigationProp<RootStackParamList, 'ForgotPassword'>;
type R = RouteProp<RootStackParamList, 'ForgotPassword'>;

const ForgotPasswordScreen: React.FC = () => {
    const navigation = useNavigation<Nav>();
    const route = useRoute<R>();
    const [email, setEmail] = useState(route.params?.initialEmail ?? '');
    const [selectedRole, setSelectedRole] = useState<UserRole>(
        route.params?.initialRole ?? UserRole.CUSTOMER,
    );
    const [showRoleMenu, setShowRoleMenu] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<'Email' | 'Phone'>('Email');
    const [phone, setPhone] = useState('');
    const [code, setCode] = useState('');
    const [isCodeSent, setIsCodeSent] = useState(false);
    const [isCodeVerified, setIsCodeVerified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    const handleSendCode = useCallback(async () => {
        if (!email.trim()) {
            setSnackbarMessage('Enter your email address');
            setSnackbarVisible(true);
            return;
        }
        if (deliveryMethod === 'Phone' && !phone.trim()) {
            setSnackbarMessage('Enter your phone number');
            setSnackbarVisible(true);
            return;
        }
        
        setLoading(true);
        const result = await authService.requestForgotPassword(
            email, 
            selectedRole, 
            deliveryMethod, 
            deliveryMethod === 'Phone' ? phone : undefined
        );
        setLoading(false);

        if (!result.ok) {
            setSnackbarMessage(result.message);
            setSnackbarVisible(true);
            return;
        }
        setIsCodeSent(true);
        setSnackbarMessage(
            deliveryMethod === 'Email' 
                ? 'Verification code sent! Check your email.' 
                : 'Verification code sent to your phone!'
        );
        setSnackbarVisible(true);
    }, [email, phone, selectedRole, deliveryMethod]);

    const handleVerifyCode = useCallback(async () => {
        if (!code.trim()) {
            setSnackbarMessage('Enter the verification code');
            setSnackbarVisible(true);
            return;
        }
        setLoading(true);
        const result = await authService.verifyResetCode(email, code);
        setLoading(false);

        if (!result.ok) {
            setSnackbarMessage(result.message || 'Invalid verification code');
            setSnackbarVisible(true);
            return;
        }
        setIsCodeVerified(true);
        setSnackbarMessage('Code verified! You can now reset your password.');
        setSnackbarVisible(true);
    }, [email, code]);

    const handleProceedToReset = useCallback(() => {
        navigation.navigate('ResetPassword', {
            email: email.trim(),
            role: toApiRole(selectedRole),
            resetToken: code.trim(),
        });
    }, [email, selectedRole, code, navigation]);

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
                    <View style={styles.header}>
                        <AppLogo size={48} />
                        <Text variant="headlineSmall" style={styles.title}>
                            {isCodeVerified ? 'Verified!' : 'Reset password'}
                        </Text>
                        <Text variant="bodyMedium" style={styles.subtitle}>
                            {isCodeVerified 
                                ? 'Your identity has been confirmed. Click below to choose your new password.'
                                : isCodeSent 
                                    ? `We sent a code to your ${deliveryMethod.toLowerCase()}. Paste it here to continue.`
                                    : 'Enter your details to receive a 6-digit reset code.'
                            }
                        </Text>
                    </View>

                    <Card style={styles.card} elevation={0}>
                        <Card.Content style={styles.cardInner}>
                            {!isCodeSent && (
                                <View style={styles.methodToggle}>
                                    <Button 
                                        mode={deliveryMethod === 'Email' ? 'contained' : 'outlined'}
                                        onPress={() => setDeliveryMethod('Email')}
                                        style={styles.methodBtn}
                                        labelStyle={{ fontSize: 13 }}
                                        icon="email-outline"
                                    >
                                        Email
                                    </Button>
                                    <Button 
                                        mode={deliveryMethod === 'Phone' ? 'contained' : 'outlined'}
                                        onPress={() => setDeliveryMethod('Phone')}
                                        style={styles.methodBtn}
                                        labelStyle={{ fontSize: 13 }}
                                        icon="phone-outline"
                                    >
                                        Phone
                                    </Button>
                                </View>
                            )}

                            <TextInput
                                label="Email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                mode="outlined"
                                disabled={isCodeSent}
                                style={styles.input}
                                outlineColor="#E2E8F0"
                                activeOutlineColor="#6366F1"
                                left={<TextInput.Icon icon="email-outline" color="#94A3B8" />}
                            />

                            {!isCodeSent && deliveryMethod === 'Phone' && (
                                <TextInput
                                    label="Phone Number"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                    mode="outlined"
                                    style={styles.input}
                                    outlineColor="#E2E8F0"
                                    activeOutlineColor="#6366F1"
                                    left={<TextInput.Icon icon="phone-outline" color="#94A3B8" />}
                                    placeholder="+1234567890"
                                />
                            )}

                            {!isCodeSent && (
                                <View style={styles.roleBlock}>
                                    <Text variant="labelLarge" style={styles.roleLabel}>
                                        Account type
                                    </Text>
                                    <Menu
                                        visible={showRoleMenu}
                                        onDismiss={() => setShowRoleMenu(false)}
                                        anchor={
                                            <Button
                                                mode="outlined"
                                                onPress={() => setShowRoleMenu(true)}
                                                style={styles.roleButton}
                                                labelStyle={styles.roleButtonLabel}
                                                icon="chevron-down"
                                                contentStyle={{ flexDirection: 'row-reverse' }}
                                            >
                                                {selectedRole}
                                            </Button>
                                        }
                                        contentStyle={styles.menuContent}
                                    >
                                        {ROLES.map((role) => (
                                            <Menu.Item
                                                key={role}
                                                onPress={() => {
                                                    setSelectedRole(role);
                                                    setShowRoleMenu(false);
                                                }}
                                                title={role}
                                                titleStyle={{ fontSize: 14 }}
                                            />
                                        ))}
                                    </Menu>
                                </View>
                            )}

                            {!isCodeSent ? (
                                <Button
                                    mode="contained"
                                    onPress={handleSendCode}
                                    loading={loading}
                                    disabled={loading}
                                    style={styles.primaryBtn}
                                    contentStyle={styles.primaryBtnContent}
                                >
                                    Send Code
                                </Button>
                            ) : (
                                <View>
                                    <TextInput
                                        label="6-Digit Reset Code"
                                        value={code}
                                        onChangeText={setCode}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        autoCapitalize="none"
                                        mode="outlined"
                                        disabled={isCodeVerified}
                                        style={styles.input}
                                        outlineColor="#E2E8F0"
                                        activeOutlineColor="#6366F1"
                                        left={<TextInput.Icon icon="key-variant" color="#94A3B8" />}
                                    />
                                    
                                    {!isCodeVerified ? (
                                        <Button
                                            mode="contained"
                                            onPress={handleVerifyCode}
                                            loading={loading}
                                            disabled={loading || code.length < 6}
                                            style={styles.primaryBtn}
                                            contentStyle={styles.primaryBtnContent}
                                        >
                                            Submit Code
                                        </Button>
                                    ) : (
                                        <Button
                                            mode="contained"
                                            onPress={handleProceedToReset}
                                            style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
                                            contentStyle={styles.primaryBtnContent}
                                            icon="lock-open-outline"
                                        >
                                            Reset Password
                                        </Button>
                                    )}
                                    
                                    <Button 
                                        mode="text" 
                                        onPress={() => {
                                            setIsCodeSent(false);
                                            setIsCodeVerified(false);
                                            setCode('');
                                        }} 
                                        textColor="#64748B"
                                        disabled={loading}
                                    >
                                        Try another method
                                    </Button>
                                </View>
                            )}

                            {!isCodeSent && (
                                <Button mode="text" onPress={() => navigation.goBack()} textColor="#64748B">
                                    Back to sign in
                                </Button>
                            )}
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
    scroll: { flexGrow: 1, padding: 24, paddingTop: 16 },
    header: { alignItems: 'center', marginBottom: 28 },
    title: { fontWeight: '800', color: '#0F172A', marginTop: 16, textAlign: 'center' },
    subtitle: { color: '#64748B', textAlign: 'center', marginTop: 8, lineHeight: 22, paddingHorizontal: 8 },
    card: {
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(226,232,240,0.9)',
    },
    cardInner: { paddingVertical: 8 },
    input: { marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.6)' },
    roleBlock: { marginBottom: 8 },
    roleLabel: { color: '#64748B', marginBottom: 8, marginLeft: 4 },
    roleButton: {
        borderRadius: 12,
        borderColor: '#E2E8F0',
        height: 50,
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    roleButtonLabel: { color: '#1E293B', fontSize: 15 },
    menuContent: { backgroundColor: '#FFF', borderRadius: 16 },
    primaryBtn: { marginTop: 20, borderRadius: 12, backgroundColor: '#6366F1' },
    primaryBtnContent: { height: 52 },
    snackbar: { backgroundColor: '#1E293B', borderRadius: 12 },
    methodToggle: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    methodBtn: { flex: 0.48, borderRadius: 12 },
});

export default React.memo(ForgotPasswordScreen);
