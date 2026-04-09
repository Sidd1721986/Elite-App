import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity } from 'react-native';
import {
    Text,
    TextInput,
    Button,
    Avatar,
    Surface,
    IconButton,
    Portal,
    Dialog,
    ActivityIndicator,
    Snackbar,
    Divider,
    Chip,
    Menu
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatAddress, parseAddress, US_STATES } from '../utils/addressUtils';

type NavigationProp = StackNavigationProp<RootStackParamList, 'Profile'>;

const ProfileScreen: React.FC = () => {
    const { user, updateProfile, requestPhoneVerification, verifyPhone } = useAuth();
    const navigation = useNavigation<NavigationProp>();

    const [name, setName] = useState(user?.name || '');
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');
    const [showStateMenu, setShowStateMenu] = useState(false);
    const [phone, setPhone] = useState(user?.phone || '');
    const [isSaving, setIsSaving] = useState(false);
    const [isRequestingOTP, setIsRequestingOTP] = useState(false);
    const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpDialogVisible, setOtpDialogVisible] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name);
            const parts = parseAddress(user.address);
            setStreet(parts.street);
            setCity(parts.city);
            setZip(parts.zip);
            setState(parts.state);
            setPhone(user.phone);
        }
    }, [user]);

    const handleSave = async () => {
        if (!name.trim()) {
            setSnackbarMessage('Name cannot be empty');
            setSnackbarVisible(true);
            return;
        }

        setIsSaving(true);
        try {
            const address = formatAddress({ street, city, zip, state });
            const result = await updateProfile({ name, address, phone });
            if (result === true) {
                setSnackbarMessage('Profile updated successfully');
                setSnackbarVisible(true);
            } else {
                setSnackbarMessage(typeof result === 'string' ? result : 'Failed to update profile');
                setSnackbarVisible(true);
            }
        } catch (error) {
            setSnackbarMessage('An unexpected error occurred');
            setSnackbarVisible(true);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestOTP = async () => {
        if (!phone.trim()) {
            setSnackbarMessage('Please enter a phone number first');
            setSnackbarVisible(true);
            return;
        }

        setIsRequestingOTP(true);
        try {
            const success = await requestPhoneVerification();
            if (success) {
                setOtpDialogVisible(true);
                setSnackbarMessage('Verification code sent (Check backend terminal for MOCK SMS)');
                setSnackbarVisible(true);
            } else {
                setSnackbarMessage('Failed to send verification code');
                setSnackbarVisible(true);
            }
        } catch (error) {
            setSnackbarMessage('An error occurred');
            setSnackbarVisible(true);
        } finally {
            setIsRequestingOTP(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp.trim()) return;

        setIsVerifyingOTP(true);
        try {
            const success = await verifyPhone(otp);
            if (success) {
                setOtpDialogVisible(false);
                setOtp('');
                setSnackbarMessage('Phone verified successfully!');
                setSnackbarVisible(true);
            } else {
                setSnackbarMessage('Invalid or expired code');
                setSnackbarVisible(true);
            }
        } catch (error) {
            setSnackbarMessage('Verification failed');
            setSnackbarVisible(true);
        } finally {
            setIsVerifyingOTP(false);
        }
    };

    if (!user) return null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    onPress={() => navigation.goBack()}
                    containerColor="#FFFFFF"
                    iconColor="#6366F1"
                />
                <Text variant="titleLarge" style={styles.headerTitle}>Profile Settings</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.profileCard} elevation={1}>
                    <View style={styles.avatarContainer}>
                        <Avatar.Text
                            size={80}
                            label={(user.name || '??').substring(0, 2).toUpperCase()}
                            style={styles.avatar}
                        />
                        <View style={styles.roleBadge}>
                            <Chip compact style={styles.badgeChip} textStyle={styles.badgeText}>
                                {user.role.toUpperCase()}
                            </Chip>
                        </View>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            label="Full Name"
                            value={name}
                            onChangeText={setName}
                            mode="outlined"
                            style={styles.input}
                            left={<TextInput.Icon icon="account-outline" />}
                        />

                        <TextInput
                            label="Email (Cannot be changed)"
                            value={user.email}
                            mode="outlined"
                            style={[styles.input, styles.disabledInput]}
                            disabled
                            left={<TextInput.Icon icon="email-outline" />}
                        />

                        <TextInput
                            label="Street Address"
                            value={street}
                            onChangeText={setStreet}
                            mode="outlined"
                            style={styles.input}
                            left={<TextInput.Icon icon="map-marker-outline" />}
                        />

                        <View style={styles.addressRow}>
                            <TextInput
                                label="City"
                                value={city}
                                onChangeText={setCity}
                                mode="outlined"
                                style={[styles.input, { flex: 2 }]}
                            />
                            <TextInput
                                label="Zip"
                                value={zip}
                                onChangeText={setZip}
                                mode="outlined"
                                style={[styles.input, { flex: 1.2 }]}
                                keyboardType="numeric"
                            />
                            <Menu
                                visible={showStateMenu}
                                onDismiss={() => setShowStateMenu(false)}
                                anchor={
                                    <TouchableOpacity 
                                        onPress={() => setShowStateMenu(true)}
                                        activeOpacity={1}
                                        style={{ flex: 1 }}
                                    >
                                        <View pointerEvents="none">
                                            <TextInput
                                                label="State"
                                                value={state}
                                                mode="outlined"
                                                style={styles.input}
                                                right={<TextInput.Icon icon="chevron-down" />}
                                                editable={false}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                }
                            >
                                <ScrollView style={{ maxHeight: 250 }}>
                                    {US_STATES.map((s) => (
                                        <Menu.Item
                                            key={s}
                                            onPress={() => {
                                                setState(s);
                                                setShowStateMenu(false);
                                            }}
                                            title={s}
                                        />
                                    ))}
                                </ScrollView>
                            </Menu>
                        </View>

                        <View style={styles.phoneContainer}>
                            <TextInput
                                label="Phone Number"
                                value={phone}
                                onChangeText={(text) => {
                                    setPhone(text);
                                }}
                                mode="outlined"
                                style={[styles.input, { flex: 1 }]}
                                keyboardType="phone-pad"
                                left={<TextInput.Icon icon="phone-outline" />}
                            />
                            {user.isPhoneVerified ? (
                                <View style={styles.verifiedBadge}>
                                    <IconButton icon="check-decagram" iconColor="#10B981" size={24} />
                                    <Text style={styles.verifiedText}>Verified</Text>
                                </View>
                            ) : (
                                <Button
                                    mode="text"
                                    onPress={handleRequestOTP}
                                    loading={isRequestingOTP}
                                    style={styles.verifyBtn}
                                    labelStyle={{ fontSize: 12 }}
                                >
                                    Verify
                                </Button>
                            )}
                        </View>

                        <Button
                            mode="contained"
                            onPress={handleSave}
                            loading={isSaving}
                            style={styles.saveBtn}
                            contentStyle={{ height: 50 }}
                        >
                            Save Changes
                        </Button>
                    </View>
                </Surface>

                <View style={styles.accountSection}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Account Details</Text>
                    <List.Item
                        title="Member Since"
                        description={new Date(user.id ? parseInt(user.id.substring(0, 8), 16) * 1000 : Date.now()).toLocaleDateString()}
                        left={props => <List.Icon {...props} icon="calendar-outline" />}
                    />
                </View>
            </ScrollView>

            <Portal>
                <Dialog visible={otpDialogVisible} onDismiss={() => setOtpDialogVisible(false)}>
                    <Dialog.Title>Verify Phone</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={{ marginBottom: 16 }}>
                            Enter the 6-digit code sent to your phone. (Check backend logs for the mock code).
                        </Text>
                        <TextInput
                            label="Verification Code"
                            value={otp}
                            onChangeText={setOtp}
                            mode="outlined"
                            keyboardType="number-pad"
                            maxLength={6}
                            style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setOtpDialogVisible(false)}>Cancel</Button>
                        <Button onPress={handleVerifyOTP} loading={isVerifyingOTP}>Verify</Button>
                    </Dialog.Actions>
                </Dialog>

                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={() => setSnackbarVisible(false)}
                    duration={3000}
                >
                    {snackbarMessage}
                </Snackbar>
            </Portal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    headerTitle: {
        fontWeight: '900',
        color: '#1E293B',
    },
    scrollContent: {
        padding: 20,
    },
    profileCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 32,
        position: 'relative',
    },
    avatar: {
        backgroundColor: '#6366F1',
    },
    roleBadge: {
        position: 'absolute',
        bottom: -10,
    },
    badgeChip: {
        backgroundColor: '#1E293B',
        height: 24,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    form: {
        gap: 16,
    },
    input: {
        backgroundColor: '#FFFFFF',
    },
    disabledInput: {
        backgroundColor: '#F1F5F9',
    },
    addressRow: {
        flexDirection: 'row',
        gap: 8,
    },
    phoneContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    verifiedBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    verifiedText: {
        fontSize: 10,
        color: '#10B981',
        fontWeight: 'bold',
        marginTop: -10,
    },
    verifyBtn: {
        marginTop: 6,
    },
    saveBtn: {
        marginTop: 16,
        borderRadius: 12,
        backgroundColor: '#6366F1',
    },
    accountSection: {
        paddingHorizontal: 4,
    },
    sectionTitle: {
        marginBottom: 12,
        color: '#64748B',
        fontWeight: '700',
        paddingHorizontal: 12,
    }
});

import { List } from 'react-native-paper';

export default ProfileScreen;
