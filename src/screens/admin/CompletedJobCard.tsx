import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Avatar, Text, IconButton } from 'react-native-paper';
import { Job, JobStatus } from '../../types/types';

interface CompletedJobCardProps {
    job: Job;
    onPress: (jobId: string) => void;
}

export const CompletedJobCard: React.FC<CompletedJobCardProps> = React.memo(({
    job,
    onPress,
}) => {
    const isInvoiced = job.status === JobStatus.INVOICED;
    const isInvoiceRequested = job.status === JobStatus.INVOICE_REQUESTED;
    const compVendorName =
        job.vendor?.name ||
        job.childJobs?.find((c: any) => c?.vendor?.name)?.vendor?.name ||
        null;
    const compStatusLabel = isInvoiced
        ? 'Invoiced'
        : isInvoiceRequested
        ? 'Invoice Requested'
        : 'Completed';
    const compStatusColor = isInvoiced ? '#0EA5E9' : isInvoiceRequested ? '#8B5CF6' : '#059669';
    const compStatusIcon  = isInvoiced ? 'file-check-outline' : isInvoiceRequested ? 'file-document-edit-outline' : 'check-decagram';

    return (
        <Card style={styles.card} elevation={0} onPress={() => onPress(job.id)}>
            <Card.Content style={styles.cardInner}>
                <View style={styles.cardHeader}>
                    <Avatar.Icon
                        size={40}
                        icon={compStatusIcon}
                        style={{ backgroundColor: compStatusColor + '15' }}
                        color={compStatusColor}
                    />
                    <View style={styles.vendorInfo}>
                        <View style={styles.headerRow}>
                            <Text variant="labelSmall" style={styles.jobNumber}>
                                #{job.jobNumber}
                            </Text>
                            <Text variant="titleMedium" style={styles.addressText} numberOfLines={1}>
                                {job.address}
                            </Text>
                        </View>
                        <Text variant="labelSmall" style={styles.customerText}>
                            {job.customer?.name || 'Homeowner'}
                        </Text>
                        {compVendorName && (
                            <View style={styles.vendorRow}>
                                <Avatar.Text
                                    size={14}
                                    label={compVendorName.substring(0, 2).toUpperCase()}
                                    style={styles.vendorAvatar}
                                    color="#059669"
                                    labelStyle={{ fontSize: 6 }}
                                />
                                <Text variant="labelSmall" style={styles.vendorName}>
                                    {compVendorName}
                                </Text>
                            </View>
                        )}
                        {job.services && job.services.length > 0 && (
                            <View style={styles.servicesRow}>
                                {job.services.map((s: string) => (
                                    <View key={s} style={styles.serviceChip}>
                                        <Text style={styles.serviceChipText}>{s.toUpperCase()}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                    <View style={styles.statusColumn}>
                        <View style={[styles.statusBadge, { backgroundColor: compStatusColor + '15', borderColor: compStatusColor + '50' }]}>
                            <Text style={[styles.statusBadgeText, { color: compStatusColor }]}>
                                {compStatusLabel.toUpperCase()}
                            </Text>
                        </View>
                        <IconButton icon="chevron-right" size={18} style={{ margin: 0 }} />
                    </View>
                </View>
            </Card.Content>
        </Card>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInner: {
        padding: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    vendorInfo: {
        flex: 1,
        marginLeft: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    jobNumber: {
        color: '#6366F1',
        fontWeight: '900',
    },
    addressText: {
        fontWeight: 'bold',
        color: '#1E293B',
        flex: 1,
    },
    customerText: {
        color: '#94A3B8',
    },
    vendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    vendorAvatar: {
        backgroundColor: '#F0FDF4',
    },
    vendorName: {
        color: '#059669',
        fontWeight: '700',
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    serviceChip: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    serviceChipText: {
        fontSize: 9,
        color: '#64748B',
        fontWeight: 'bold',
    },
    statusColumn: {
        alignItems: 'flex-end',
        gap: 6,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '800',
    },
});
