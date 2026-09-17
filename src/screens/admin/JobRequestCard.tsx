import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Surface, Button } from 'react-native-paper';
import { Job } from '../../types/types';

interface JobRequestCardProps {
    job: Job;
    onPress: (jobId: string) => void;
    onAssign: (jobId: string) => void;
    timelineBarColor: string;
}

export const JobRequestCard: React.FC<JobRequestCardProps> = React.memo(({
    job,
    onPress,
    onAssign,
    timelineBarColor,
}) => {
    const partsDone = (job.childJobs || []).filter(c => c?.vendorId);
    const remainingSvc = job.services?.length || 0;
    const itemsLeft = (job.items || []).filter(i => i && !i.isAssigned).length;
    const stillNeedsVendor = remainingSvc > 0 || itemsLeft > 0;

    const partsLine = partsDone
        .map(c => `#${c.jobNumber ?? ''}${c.jobSuffix || ''} → ${c.vendor?.name || 'Vendor'}`)
        .join(' • ');

    const assignLine =
        remainingSvc > 0
            ? `Still needs vendor assignment: ${(job.services || []).join(', ')}`
            : `Still needs vendor assignment for ${itemsLeft} item(s).`;

    return (
        <Card
            style={styles.card}
            elevation={0}
            onPress={() => onPress(job.id)}
        >
            <Card.Content style={styles.cardInnerFlush}>
                <View style={styles.requestCardRow}>
                    <View style={[styles.timelineBar, { backgroundColor: timelineBarColor }]} />
                    <View style={styles.requestCardContent}>
                        <View style={styles.vendorInfo}>
                            <View style={styles.headerRow}>
                                <Text variant="labelSmall" style={styles.jobNumber}>
                                    #{job.jobNumber}
                                </Text>
                                <Text variant="titleMedium" style={styles.addressText} numberOfLines={1}>
                                    {job.address}
                                </Text>
                            </View>

                            <Text variant="labelSmall" style={styles.customerName}>
                                {job.customer?.name || 'Homeowner'}
                            </Text>

                            {job.services && job.services.length > 0 && (
                                <View style={styles.servicesRow}>
                                    {job.services.map(s => (
                                        <View key={s} style={styles.serviceBadge}>
                                            <Text style={styles.serviceBadgeText}>
                                                {s.toUpperCase()}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text variant="labelSmall" style={styles.descriptionText} numberOfLines={1}>
                                {job.description}
                            </Text>

                            {stillNeedsVendor && (
                                <Surface style={styles.partialAssignNotice} elevation={0}>
                                    {partsLine.length > 0 && (
                                        <Text variant="labelSmall" style={styles.partialAssignParts}>
                                            {partsLine}
                                        </Text>
                                    )}
                                    <Text variant="labelSmall" style={styles.partialAssignMain}>
                                        {assignLine}
                                    </Text>
                                </Surface>
                            )}
                        </View>

                        <View style={styles.actionColumn}>
                            <Button
                                mode="contained"
                                compact
                                onPress={() => onAssign(job.id)}
                                style={styles.jobActionBtn}
                                icon="account-plus-outline"
                                labelStyle={{ fontSize: 11 }}
                            >
                                Assign
                            </Button>
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
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInnerFlush: {
        padding: 0,
    },
    requestCardRow: {
        flexDirection: 'row',
        minHeight: 80,
    },
    timelineBar: {
        width: 6,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    requestCardContent: {
        flex: 1,
        flexDirection: 'row',
        padding: 12,
        alignItems: 'center',
    },
    vendorInfo: {
        flex: 1,
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
    customerName: {
        color: '#64748B',
        fontWeight: 'bold',
    },
    servicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginVertical: 4,
    },
    serviceBadge: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    serviceBadgeText: {
        fontSize: 9,
        color: '#6366F1',
        fontWeight: 'bold',
    },
    descriptionText: {
        color: '#94A3B8',
    },
    partialAssignNotice: {
        marginTop: 6,
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    partialAssignParts: {
        color: '#92400E',
        fontWeight: '600',
        marginBottom: 2,
    },
    partialAssignMain: {
        color: '#B45309',
        fontSize: 11,
    },
    actionColumn: {
        marginLeft: 8,
    },
    jobActionBtn: {
        backgroundColor: '#6366F1',
        borderRadius: 8,
    },
});
