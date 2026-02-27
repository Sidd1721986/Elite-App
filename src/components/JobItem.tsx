import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Chip, ProgressBar, IconButton, Button, Surface } from 'react-native-paper';
import { Job, JobStatus } from '../types/types';

interface JobItemProps {
    job: Job;
    onViewDetails: (jobId: string) => void;
    onModify?: (jobId: string) => void;
}

const JobItem: React.FC<JobItemProps> = ({ job, onViewDetails, onModify }) => {
    const getStatusInfo = React.useCallback((status: string) => {
        const steps = [
            JobStatus.SUBMITTED,
            JobStatus.ASSIGNED,
            JobStatus.ACCEPTED,
            JobStatus.REACHED_OUT,
            JobStatus.APPT_SET,
            JobStatus.SALE,
            JobStatus.COMPLETED,
            JobStatus.INVOICED
        ];
        const index = steps.indexOf(status as JobStatus);
        const progress = index === -1 ? 0.1 : (index + 1) / steps.length;

        let color = '#64748B';
        let bgColor = '#F1F5F9';

        switch (status) {
            case JobStatus.SUBMITTED: color = '#6366F1'; bgColor = '#EEF2FF'; break;
            case JobStatus.ASSIGNED: color = '#8B5CF6'; bgColor = '#F5F3FF'; break;
            case JobStatus.ACCEPTED: color = '#3B82F6'; bgColor = '#EFF6FF'; break;
            case JobStatus.REACHED_OUT: color = '#2563EB'; bgColor = '#EBF2FF'; break;
            case JobStatus.APPT_SET: color = '#F59E0B'; bgColor = '#FFFBEB'; break;
            case JobStatus.SALE: color = '#10B981'; bgColor = '#ECFDF5'; break;
            case JobStatus.COMPLETED: color = '#059669'; bgColor = '#ECFDF5'; break;
            case JobStatus.INVOICED: color = '#15803D'; bgColor = '#F0FDF4'; break;
            case JobStatus.EXPIRED: color = '#EF4444'; bgColor = '#FEF2F2'; break;
            case JobStatus.FOLLOW_UP: color = '#7C3AED'; bgColor = '#F5F3FF'; break;
        }

        return { progress, color, bgColor };
    }, []);

    const { progress, color, bgColor } = getStatusInfo(job.status);

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
                        onPress={() => onViewDetails(job.id)}
                        style={styles.detailsBtn}
                        contentStyle={styles.btnContent}
                    >
                        Details
                    </Button>
                    {onModify && job.status === JobStatus.SUBMITTED && (
                        <Button
                            mode="outlined"
                            onPress={() => onModify(job.id)}
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
        marginBottom: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    content: {
        padding: 4,
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
        maxWidth: 200,
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
        height: 40,
    },
});

export default React.memo(JobItem);
