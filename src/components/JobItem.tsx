import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Chip, ProgressBar, MD3Colors, IconButton, Button } from 'react-native-paper';
import { Job, JobStatus } from '../types/types';

interface JobItemProps {
    job: Job;
    onViewDetails: (jobId: string) => void;
    onModify?: (jobId: string) => void;
}

const JobItem: React.FC<JobItemProps> = ({ job, onViewDetails, onModify }) => {
    const getStatusStep = React.useCallback((status: JobStatus) => {
        const steps = [
            JobStatus.SUBMITTED,
            JobStatus.SENT_TO_VENDORS,
            JobStatus.RECEIVED,
            JobStatus.QUOTED,
            JobStatus.SCHEDULED,
            JobStatus.COMPLETED_AWAITING_PAYMENT
        ];
        const index = steps.indexOf(status);
        return index === -1 ? 0 : (index + 1) / steps.length;
    }, []);

    return (
        <Card style={styles.jobCard}>
            <Card.Content>
                <View style={styles.jobHeader}>
                    <Text variant="titleMedium" style={styles.jobId}>Job #{job.id}</Text>
                    <Chip style={styles.statusChip}>{job.status}</Chip>
                </View>
                <Text variant="bodyMedium" style={styles.jobAddress}>{job.address}</Text>
                <Text variant="bodySmall" numberOfLines={2}>{job.description}</Text>

                <View style={styles.progressContainer}>
                    <Text variant="labelSmall">Status Progress</Text>
                    <ProgressBar
                        progress={getStatusStep(job.status)}
                        color={MD3Colors.primary50}
                        style={styles.progressBar}
                    />
                </View>

                {job.status === JobStatus.SCHEDULED && job.scheduledDate && (
                    <View style={styles.scheduleInfo}>
                        <IconButton icon="calendar" size={16} />
                        <Text variant="labelMedium">Scheduled for: {job.scheduledDate}</Text>
                    </View>
                )}

                <Card.Actions>
                    <Button
                        mode="outlined"
                        onPress={() => onViewDetails(job.id)}
                    >
                        View Details
                    </Button>
                    {onModify && job.status === JobStatus.SUBMITTED && (
                        <Button mode="text" onPress={() => onModify(job.id)}>Modify</Button>
                    )}
                </Card.Actions>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    jobCard: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    jobHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    jobId: {
        fontWeight: 'bold',
    },
    statusChip: {
        height: 28,
        backgroundColor: '#e3f2fd',
    },
    jobAddress: {
        marginBottom: 8,
        color: '#555',
    },
    progressContainer: {
        marginVertical: 12,
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    scheduleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f4f8',
        borderRadius: 4,
        marginBottom: 8,
    },
});

export default React.memo(JobItem);
