import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Chip, ProgressBar, IconButton, Button, Surface } from 'react-native-paper';
import { Job, JobStatus } from '../types/types';

interface JobItemProps {
    job: Job;
    onViewDetails: (jobId: string) => void;
    onModify?: (jobId: string) => void;
}

const DEFAULT_STATUS = { progress: 0.1, color: '#64748B', bgColor: '#F1F5F9' };

const STATUS_INFO_MAP: Record<string, { progress: number; color: string; bgColor: string }> = {
    [JobStatus.SUBMITTED]: { progress: 1 / 8, color: '#6366F1', bgColor: '#EEF2FF' },
    [JobStatus.ASSIGNED]: { progress: 2 / 8, color: '#8B5CF6', bgColor: '#F5F3FF' },
    [JobStatus.ACCEPTED]: { progress: 3 / 8, color: '#3B82F6', bgColor: '#EFF6FF' },
    [JobStatus.REACHED_OUT]: { progress: 4 / 8, color: '#2563EB', bgColor: '#EBF2FF' },
    [JobStatus.APPT_SET]: { progress: 5 / 8, color: '#F59E0B', bgColor: '#FFFBEB' },
    [JobStatus.SALE]: { progress: 6 / 8, color: '#10B981', bgColor: '#ECFDF5' },
    [JobStatus.COMPLETED]: { progress: 7 / 8, color: '#059669', bgColor: '#ECFDF5' },
    [JobStatus.INVOICED]: { progress: 1, color: '#15803D', bgColor: '#F0FDF4' },
    [JobStatus.EXPIRED]: { progress: 0.1, color: '#EF4444', bgColor: '#FEF2F2' },
    [JobStatus.FOLLOW_UP]: { progress: 0.5, color: '#7C3AED', bgColor: '#F5F3FF' },
};

function getStatusInfo(status: string) {
    return STATUS_INFO_MAP[status] ?? DEFAULT_STATUS;
}

const JobItem: React.FC<JobItemProps> = ({ job, onViewDetails, onModify }) => {
    const { progress, color, bgColor } = getStatusInfo(job.status);
    const handleViewDetails = React.useCallback(() => onViewDetails(job.id), [job.id, onViewDetails]);
    const handleModify = React.useCallback(() => onModify?.(job.id), [job.id, onModify]);

    return (
        <Card style={styles.jobCard} elevation={0}>
            <Card.Content style={styles.content}>
                <View style={styles.jobHeader}>
                    <View>
                        <Text variant="labelSmall" style={styles.jobIdLabel}>ID: #{job.id.substring(0, 8).toUpperCase()}</Text>
                        <Text variant="titleMedium" style={styles.jobAddress} numberOfLines={1}>{job.address}</Text>

                        {(job.contactPhone || job.contactEmail) && (
                            <View style={styles.contactRow}>
                                {job.contactPhone && (
                                    <View style={styles.contactBadge}>
                                        <IconButton icon="phone" size={12} style={styles.contactIcon} iconColor="#6366F1" />
                                        <Text variant="labelSmall" style={styles.contactText}>{job.contactPhone}</Text>
                                    </View>
                                )}
                                {job.contactEmail && (
                                    <View style={styles.emailBadge}>
                                        <IconButton icon="email" size={12} style={styles.contactIcon} iconColor="#94A3B8" />
                                        <Text variant="labelSmall" style={styles.contactText} numberOfLines={1}>{job.contactEmail}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                    <Chip
                        style={[styles.statusChip, { backgroundColor: bgColor }]}
                        textStyle={[styles.statusText, { color: color }]}
                    >
                        {job.status}
                    </Chip>
                </View>

                <Text variant="bodyMedium" style={styles.jobDesc} numberOfLines={2}>
                    {job.description}
                </Text>

                <View style={styles.progressContainer}>
                    <View style={styles.progressHeader}>
                        <Text variant="labelSmall" style={styles.progressLabel}>Track Progress</Text>
                        <Text variant="labelSmall" style={styles.progressValue}>{Math.round(progress * 100)}%</Text>
                    </View>
                    <ProgressBar
                        progress={progress}
                        color={color}
                        style={styles.progressBar}
                    />
                </View>

                {job.scheduledDate && (
                    <Surface style={styles.scheduleInfo} elevation={0}>
                        <IconButton icon="calendar-check" size={16} iconColor="#10B981" />
                        <Text variant="labelMedium" style={styles.scheduleText}>Scheduled: {job.scheduledDate}</Text>
                    </Surface>
                )}

                <View style={styles.actions}>
                    <Button
                        mode="contained"
                        onPress={handleViewDetails}
                        style={styles.detailsBtn}
                        contentStyle={styles.btnContent}
                    >
                        Details
                    </Button>
                    {onModify && job.status === JobStatus.SUBMITTED && (
                        <Button
                            mode="outlined"
                            onPress={handleModify}
                            style={styles.modifyBtn}
                            contentStyle={styles.btnContent}
                        >
                            Modify
                        </Button>
                    )}
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    jobCard: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    content: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    jobHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    jobIdLabel: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    jobAddress: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginTop: 2,
        maxWidth: '75%',
    },
    statusChip: {
        height: 28,
        borderRadius: 8,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    jobDesc: {
        color: '#64748B',
        lineHeight: 20,
        marginBottom: 8,
    },
    contactRow: {
        flexDirection: 'row',
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    contactBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingRight: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    contactText: {
        color: '#475569',
        fontSize: 11,
    },
    emailBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingRight: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginLeft: 8,
    },
    contactIcon: {
        margin: 0,
    },
    progressContainer: {
        marginBottom: 16,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    progressLabel: {
        color: '#94A3B8',
        textTransform: 'uppercase',
    },
    progressValue: {
        color: '#1E293B',
        fontWeight: 'bold',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F1F5F9',
    },
    scheduleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        marginBottom: 16,
        paddingRight: 12,
    },
    scheduleText: {
        color: '#065F46',
        fontWeight: 'bold',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    detailsBtn: {
        flex: 1,
        borderRadius: 12,
    },
    modifyBtn: {
        flex: 1,
        borderRadius: 12,
        borderColor: '#E2E8F0',
    },
    btnContent: {
        height: 44,
    },
});

export default React.memo(JobItem);
