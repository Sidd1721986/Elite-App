import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
    Text,
    Avatar,
    Surface,
    IconButton,
    List,
    Divider,
    Chip
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
    RootStackParamList
} from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = StackNavigationProp<RootStackParamList, 'AccountDetails'>;

const AccountDetailsScreen: React.FC = () => {
    const { user } = useAuth();

    const navigation = useNavigation<NavigationProp>();

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
                <Text variant="titleLarge" style={styles.headerTitle}>Account Details</Text>
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

                    <Text variant="headlineSmall" style={styles.userName}>{user.name}</Text>
                    <Text variant="bodyMedium" style={styles.userEmail}>{user.email}</Text>

                    <Divider style={styles.divider} />

                    <List.Section style={styles.listSection}>
                        <List.Item
                            title="Full Name"
                            description={user.name}
                            left={props => <List.Icon {...props} icon="account-outline" />}
                        />
                        <Divider />
                        <List.Item
                            title="Email Address"
                            description={user.email}
                            left={props => <List.Icon {...props} icon="email-outline" />}
                        />
                        <Divider />
                        <List.Item
                            title="Service Address"
                            description={user.address || 'Not set'}
                            left={props => <List.Icon {...props} icon="map-marker-outline" />}
                        />
                        <Divider />
                        <List.Item
                            title="Phone Number"
                            description={user.phone || 'Not set'}
                            left={props => <List.Icon {...props} icon="phone-outline" />}
                            right={props => user.isPhoneVerified ? (
                                <List.Icon {...props} icon="check-decagram" color="#10B981" />
                            ) : undefined}
                        />
                        <Divider />
                        <List.Item
                            title="Account Type"
                            description={user.role}
                            left={props => <List.Icon {...props} icon="shield-account-outline" />}
                        />
                        <Divider />
                        <List.Item
                            title="Member Since"
                            description={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                            left={props => <List.Icon {...props} icon="calendar-outline" />}
                        />
                    </List.Section>

                    <Divider style={styles.divider} />

                    <List.Section style={styles.listSection}>
                        <List.Subheader style={{ fontWeight: 'bold', color: '#64748B' }}>LEGAL & SUPPORT</List.Subheader>
                        <List.Item
                            title="Privacy Policy"
                            onPress={() => navigation.navigate('PrivacyPolicy')}
                            left={props => <List.Icon {...props} icon="shield-account-outline" />}
                            right={props => <List.Icon {...props} icon="chevron-right" />}
                        />
                        <List.Item
                            title="Terms of Service"
                            onPress={() => navigation.navigate('TermsOfService')}
                            left={props => <List.Icon {...props} icon="file-document-outline" />}
                            right={props => <List.Icon {...props} icon="chevron-right" />}
                        />
                        <List.Item
                            title="Contact Support"
                            onPress={() => navigation.navigate('ContactSupport')}
                            left={props => <List.Icon {...props} icon="help-circle-outline" />}
                            right={props => <List.Icon {...props} icon="chevron-right" />}
                        />
                    </List.Section>

                    <Divider style={styles.divider} />
                </Surface>
            </ScrollView>
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
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: 20,
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
    userName: {
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 12,
    },
    userEmail: {
        color: '#64748B',
        marginBottom: 24,
    },
    divider: {
        width: '100%',
        marginBottom: 8,
    },
    listSection: {
        width: '100%',
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        paddingRight: 48,
        paddingVertical: 8,
    },
    infoText: {
        color: '#4F46E5',
        lineHeight: 18,
    }
});

export default AccountDetailsScreen;
