import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Chip, Divider, IconButton } from 'react-native-paper';
import { Job, JobStatus, Urgency } from '../../types/types';

export const getStatusStyle = (status: string) => {
    switch (status) {
        case JobStatus.SUBMITTED: return { color: '#6366F1', bg: '#EEF2FF', icon: 'send-circle-outline' };
        case JobStatus.ASSIGNED: return { color: '#8B5CF6', bg: '#F5F3FF', icon: 'account-arrow-right-outline' };
        case JobStatus.ACCEPTED: return { color: '#3B82F6', bg: '#EFF6FF', icon: 'check-circle-outline' };
        case 'ReachedOut': return { color: '#F59E0B', bg: '#FFFBEB', icon: 'phone-outgoing-outline' };
        case 'ApptSet': return { color: '#EC4899', bg: '#FDF2F8', icon: 'calendar-check-outline' };
        case JobStatus.SALE: return { color: '#10B981', bg: '#ECFDF5', icon: 'currency-usd' };
        case JobStatus.COMPLETED: return { color: '#059669', bg: '#ECFDF5', icon: 'flag-checkered' };
        case JobStatus.INVOICE_REQUESTED: return { color: '#F97316', bg: '#FFF7ED', icon: 'file-document-edit-outline' };
        case JobStatus.INVOICED: return { color: '#0F172A', bg: '#F1F5F9', icon: 'file-check-outline' };
        default: return { color: '#64748B', bg: '#F1F5F9', icon: 'help-circle-outline' };
    }
};

interface JobHeaderCardProps {
    job: Job;
    onEditAmount?: () => void;
    canEditAmount?: boolean;
    onChangeStage?: () => void;
    canChangeStage?: boolean;
}

export const JobHeaderCard: React.FC<JobHeaderCardProps> = React.memo(({
    job,
    onEditAmount,
    canEditAmount,
    onChangeStage,
    canChangeStage,
}) => {
    const statusStyle = getStatusStyle(job.status);

    return (
        <Card style={styles.card} elevation={0}>
            <Card.Content style={styles.cardInner}>
                <View style={styles.topRow}>
                    <View style={styles.jobNumBadge}>
                        <Text style={styles.jobNumText}>#{job.jobNumber}</Text>
                    </View>
                    <View style={styles.statusWrap}>
                        <Chip
                            icon={statusStyle.icon}
                            style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}
                            textStyle={{ color: statusStyle.color, fontWeight: '700', fontSize: 11 }}
                            onPress={canChangeStage && onChangeStage ? onChangeStage : undefined}
                        >
                            {job.status.toUpperCase()}
                        </Chip>
                        {canChangeStage && onChangeStage && (
                            <IconButton
                                icon="pencil-outline"
                                size={14}
                                iconColor={statusStyle.color}
                                onPress={onChangeStage}
                                style={styles.changeStageIconBtn}
                                accessibilityLabel="Change Job Stage"
                            />
                        )}
                    </View>
                </View>

                <Text variant="headlineSmall" style={styles.address}>
                    {job.address}
                </Text>

                <Text variant="bodyMedium" style={styles.description}>
                    {job.description}
                </Text>

                {job.services && job.services.length > 0 && (
                    <View style={styles.servicesRow}>
                        {job.services.map((s: string) => (
                            <View key={s} style={styles.serviceTag}>
                                <Text style={styles.serviceTagText}>{s.toUpperCase()}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <Divider style={styles.divider} />

                <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                        <Text variant="labelSmall" style={styles.metaLabel}>URGENCY</Text>
                        <Text variant="bodyMedium" style={[
                            styles.metaValue,
                            job.urgency === Urgency.IMMEDIATE && { color: '#EF4444' },
                            job.urgency === Urgency.THIS_WEEK && { color: '#F59E0B' },
                        ]}>
                            {job.urgency || 'Standard'}
                        </Text>
                    </View>

                    <View style={styles.metaItem}>
                        <Text variant="labelSmall" style={styles.metaLabel}>CONTRACT AMOUNT</Text>
                        <View style={styles.amountRow}>
                            <Text variant="titleMedium" style={styles.amountValue}>
                                {job.contractAmount != null ? `$${Number(job.contractAmount).toFixed(2)}` : 'Pending Quote'}
                            </Text>
                            {canEditAmount && onEditAmount && (
                                <IconButton
                                    icon="pencil-outline"
                                    size={16}
                                    iconColor="#6366F1"
                                    onPress={onEditAmount}
                                    style={styles.editBtn}
                                />
                            )}
                        </View>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInner: {
        padding: 16,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    jobNumBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    jobNumText: {
        color: '#6366F1',
        fontWeight: '900',
        fontSize: 13,
    },
    statusWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    changeStageIconBtn: {
        margin: 0,
        padding: 0,
        width: 24,
        height: 24,
    },
    statusChip: {
        borderRadius: 10,
    },
    address: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 6,
    },
    description: {
        color: '#64748B',
        lineHeight: 20,
        marginBottom: 10,
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    serviceTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    serviceTagText: {
        fontSize: 10,
        color: '#475569',
        fontWeight: '700',
    },
    divider: {
        marginVertical: 12,
        backgroundColor: '#F1F5F9',
    },
    metaGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metaItem: {
        flex: 1,
    },
    metaLabel: {
        color: '#94A3B8',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    metaValue: {
        fontWeight: '700',
        color: '#334155',
        marginTop: 2,
    },
    amountRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    amountValue: {
        fontWeight: '800',
        color: '#059669',
    },
    editBtn: {
        margin: 0,
        marginLeft: 2,
    },
});
