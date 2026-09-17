import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Avatar } from 'react-native-paper';
import { Job } from '../../types/types';

interface JobContactSectionProps {
    job: Job;
}

export const JobContactSection: React.FC<JobContactSectionProps> = React.memo(({ job }) => {
    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Contact & Stakeholders</Text>

            {/* Customer Profile */}
            <Surface style={styles.contactCard} elevation={0}>
                <View style={styles.contactRow}>
                    <Avatar.Text
                        size={48}
                        label={(job.customer?.name || 'CU').substring(0, 2).toUpperCase()}
                        style={styles.customerAvatar}
                    />
                    <View style={styles.contactInfo}>
                        <Text variant="titleMedium" style={styles.contactName}>
                            {job.customer?.name && job.customer.name !== 'Homeowner' ? job.customer.name : 'Homeowner Profile'}
                        </Text>
                        <Text variant="labelSmall" style={styles.contactType}>Homeowner Profile</Text>
                        <View style={styles.detailsBox}>
                            <Text variant="bodySmall" style={styles.detailText}>
                                {job.customer?.phone || 'No phone provided'}
                            </Text>
                            <Text variant="bodySmall" style={styles.detailText}>
                                {job.customer?.email || 'No email provided'}
                            </Text>
                        </View>
                    </View>
                </View>
            </Surface>

            {/* On-site Contact Details */}
            {(job.contactPhone || job.contactEmail) && (
                <Surface style={[styles.contactCard, styles.onsiteCard]} elevation={0}>
                    <View style={styles.contactRow}>
                        <Avatar.Icon
                            size={48}
                            icon="account-tie-outline"
                            style={styles.onsiteAvatar}
                            color="#6366F1"
                        />
                        <View style={styles.contactInfo}>
                            <Text variant="titleMedium" style={styles.contactName}>On-site Contact</Text>
                            <Text variant="labelSmall" style={styles.contactType}>Specific Point of Contact</Text>
                            <View style={styles.detailsBox}>
                                <Text variant="bodySmall" style={styles.onsitePhone}>{job.contactPhone}</Text>
                                <Text variant="bodySmall" style={styles.detailText}>{job.contactEmail}</Text>
                            </View>
                        </View>
                    </View>
                </Surface>
            )}

            {/* Assigned Vendor Profile */}
            {job.vendor && (
                <Surface style={[styles.contactCard, styles.vendorCard]} elevation={0}>
                    <View style={styles.contactRow}>
                        <Avatar.Text
                            size={48}
                            label={(job.vendor?.name || 'VN').substring(0, 2).toUpperCase()}
                            style={styles.vendorAvatar}
                            color="#10B981"
                        />
                        <View style={styles.contactInfo}>
                            <Text variant="titleMedium" style={styles.contactName}>{job.vendor?.name}</Text>
                            <Text variant="labelSmall" style={styles.contactType}>Assigned Vendor</Text>
                            <View style={styles.detailsBox}>
                                <Text variant="bodySmall" style={styles.detailText}>
                                    {job.vendor?.phone || 'No phone provided'}
                                </Text>
                                <Text variant="bodySmall" style={styles.detailText}>
                                    {job.vendor?.email || 'No email provided'}
                                </Text>
                            </View>
                        </View>
                    </View>
                </Surface>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    section: {
        marginBottom: 24,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    contactCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    onsiteCard: {
        marginTop: 12,
        backgroundColor: '#F8FAFC',
    },
    vendorCard: {
        marginTop: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    customerAvatar: {
        backgroundColor: '#EEF2FF',
    },
    onsiteAvatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorAvatar: {
        backgroundColor: '#ECFDF5',
    },
    contactInfo: {
        marginLeft: 14,
        flex: 1,
    },
    contactName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    contactType: {
        color: '#94A3B8',
        fontWeight: '600',
    },
    detailsBox: {
        marginTop: 4,
    },
    detailText: {
        color: '#64748B',
    },
    onsitePhone: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
});
