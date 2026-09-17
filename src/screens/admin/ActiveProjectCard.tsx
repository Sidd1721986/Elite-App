import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Avatar, IconButton, Button, Chip } from 'react-native-paper';
import { Job } from '../../types/types';
import { StatusPipeline, VENDOR_PIPELINE, getPipelineIndex } from './StatusPipeline';

interface ActiveProjectCardProps {
    job: Job;
    allJobs: Job[];
    onPress: (jobId: string) => void;
    onReassign: (rootJobId: string) => void;
}

export const ActiveProjectCard: React.FC<ActiveProjectCardProps> = React.memo(({
    job,
    allJobs,
    onPress,
    onReassign,
}) => {
    const isChildJob = Boolean(job.parentJobId);
    const parentJob = isChildJob
        ? allJobs.find(j => String(j.id) === String(job.parentJobId))
        : null;

    const displayAddress  = parentJob?.address  ?? job.address;
    const displayCustomer = parentJob?.customer ?? job.customer;
    const displayJobNum   = parentJob
        ? `${parentJob.jobNumber}${job.jobSuffix ?? ''}`
        : String(job.jobNumber ?? '');

    const pipelineIdx = getPipelineIndex(job.status);
    const currentStep = pipelineIdx >= 0 ? VENDOR_PIPELINE[pipelineIdx] : null;

    const vendorName =
        job.vendor?.name ||
        job.childJobs?.find((c: any) => c?.vendor?.name)?.vendor?.name ||
        null;

    const rootJobId = parentJob?.id ?? job.id;

    return (
        <Card
            style={styles.card}
            elevation={0}
            onPress={() => onPress(job.id)}
        >
            <Card.Content style={styles.cardInner}>
                {isChildJob && (
                    <View style={styles.splitScopeBanner}>
                        <IconButton icon="call-split" size={12} iconColor="#7C3AED" style={{ margin: 0, padding: 0, marginRight: 2 }} />
                        <Text style={styles.splitScopeText}>
                            Scope {job.jobSuffix || ''} · {(job.services || []).join(', ') || 'Split assignment'}
                        </Text>
                    </View>
                )}

                <View style={styles.topRow}>
                    <View style={[
                        styles.iconWrap,
                        { backgroundColor: (currentStep?.color ?? '#6366F1') + '18' },
                    ]}>
                        <IconButton
                            icon={currentStep?.icon ?? 'progress-wrench'}
                            size={18}
                            iconColor={currentStep?.color ?? '#6366F1'}
                            style={{ margin: 0, padding: 0 }}
                        />
                    </View>
                    <View style={styles.headerInfo}>
                        <View style={styles.titleRow}>
                            <Text style={styles.jobNumber}>#{displayJobNum}</Text>
                            <Text variant="titleSmall" style={styles.addressText} numberOfLines={1}>
                                {displayAddress}
                            </Text>
                        </View>
                        <Text variant="labelSmall" style={styles.customerText}>
                            {displayCustomer?.name || 'Homeowner'}
                        </Text>
                        {vendorName && (
                            <View style={styles.vendorRow}>
                                <Avatar.Text
                                    size={16}
                                    label={vendorName.substring(0, 2).toUpperCase()}
                                    style={styles.vendorAvatar}
                                    labelStyle={{ fontSize: 7 }}
                                    color="#4338CA"
                                />
                                <Text variant="labelSmall" style={styles.vendorNameText} numberOfLines={1}>
                                    {vendorName}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Chip
                        style={[styles.statusChip, { backgroundColor: (currentStep?.color ?? '#6366F1') + '15' }]}
                        textStyle={{ color: currentStep?.color ?? '#6366F1', fontSize: 10, fontWeight: '700' }}
                    >
                        {currentStep?.label ?? job.status}
                    </Chip>
                </View>

                <StatusPipeline currentStatus={job.status} />

                <View style={styles.cardFooter}>
                    <Button
                        mode="outlined"
                        compact
                        onPress={() => onReassign(rootJobId)}
                        style={styles.reassignBtn}
                        labelStyle={{ fontSize: 11 }}
                    >
                        Reassign
                    </Button>
                    <Button
                        mode="contained"
                        compact
                        onPress={() => onPress(job.id)}
                        style={styles.detailsBtn}
                        labelStyle={{ fontSize: 11 }}
                    >
                        View Details
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInner: {
        padding: 14,
    },
    splitScopeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginBottom: 8,
    },
    splitScopeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6D28D9',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    jobNumber: {
        fontWeight: '800',
        color: '#6366F1',
        fontSize: 13,
    },
    addressText: {
        fontWeight: 'bold',
        color: '#1E293B',
        flex: 1,
    },
    customerText: {
        color: '#64748B',
        fontWeight: '500',
    },
    vendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    vendorAvatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorNameText: {
        color: '#4338CA',
        fontWeight: '600',
    },
    statusChip: {
        borderRadius: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 10,
    },
    reassignBtn: {
        borderColor: '#CBD5E1',
        borderRadius: 8,
    },
    detailsBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 8,
    },
});
