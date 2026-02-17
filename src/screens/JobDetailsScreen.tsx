import * as React from 'react';
import { View, ScrollView, StyleSheet, Image, Dimensions } from 'react-native';
import { Text, Card, Button, Avatar, Divider, List, Chip, Surface, IconButton } from 'react-native-paper';
import { useJobs } from '../context/JobContext';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList, JobStatus } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type JobDetailsRouteProp = RouteProp<RootStackParamList, 'JobDetails'>;

const { width } = Dimensions.get('window');

const JobDetailsScreen: React.FC = () => {
    const route = useRoute<JobDetailsRouteProp>();
    const navigation = useNavigation();
    const { getJobById } = useJobs();
    const { jobId } = route.params;

    const job = getJobById(jobId);

    if (!job) {
        return (
            <View style={styles.centered}>
                <Avatar.Icon size={80} icon="alert-circle-outline" style={{ backgroundColor: '#FFCDD2' }} color="#D32F2F" />
                <Text variant="headlineSmall" style={{ marginTop: 16 }}>Job not found</Text>
                <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 24 }}>
                    Go Back
                </Button>
            </View>
        );
    }

    const getStatusColor = (status: JobStatus) => {
        switch (status) {
            case JobStatus.SUBMITTED: return '#2196F3';
            case JobStatus.SENT_TO_VENDORS: return '#9C27B0';
            case JobStatus.RECEIVED: return '#00BCD4';
            case JobStatus.QUOTED: return '#FF9800';
            case JobStatus.SCHEDULED: return '#4CAF50';
            case JobStatus.COMPLETED_AWAITING_PAYMENT: return '#795548';
            default: return '#757575';
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <Surface style={styles.headerSurface} elevation={1}>
                    <View style={styles.headerInfo}>
                        <View>
                            <Text variant="labelLarge" style={styles.jobIdText}>JOB ID: {job.id}</Text>
                            <Text variant="headlineSmall" style={styles.addressTitle}>{job.address}</Text>
                        </View>
                        <Chip
                            style={[styles.statusChip, { backgroundColor: getStatusColor(job.status) }]}
                            textStyle={styles.statusChipText}
                        >
                            {job.status}
                        </Chip>
                    </View>
                    <Divider style={styles.headerDivider} />
                    <View style={styles.headerStats}>
                        <View style={styles.statItem}>
                            <IconButton icon="calendar-clock" size={20} iconColor="#666" />
                            <Text variant="bodySmall">{new Date(job.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <IconButton icon="alert-decagram" size={20} iconColor="#E91E63" />
                            <Text variant="bodySmall">{job.urgency}</Text>
                        </View>
                    </View>
                </Surface>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Description</Text>
                    <Card style={styles.contentCard}>
                        <Card.Content>
                            <Text variant="bodyMedium" style={styles.descriptionText}>
                                {job.description}
                            </Text>
                            {job.otherDetails && (
                                <>
                                    <Divider style={styles.innerDivider} />
                                    <Text variant="labelSmall" style={styles.subLabel}>Additional Instructions</Text>
                                    <Text variant="bodyMedium">{job.otherDetails}</Text>
                                </>
                            )}
                        </Card.Content>
                    </Card>
                </View>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Photos</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                        {job.photos.length > 0 ? (
                            job.photos.map((photo, index) => (
                                <Card key={index} style={styles.photoCard}>
                                    <Image source={{ uri: photo }} style={styles.photoImage} />
                                </Card>
                            ))
                        ) : (
                            <Card style={styles.noPhotoCard}>
                                <Card.Content style={styles.noPhotoContent}>
                                    <Avatar.Icon size={40} icon="camera-off" style={{ backgroundColor: '#eee' }} color="#999" />
                                    <Text variant="bodySmall" style={{ marginTop: 8 }}>No photos added</Text>
                                </Card.Content>
                            </Card>
                        )}
                    </ScrollView>
                </View>

                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Contacts</Text>
                    {job.contacts.map((contact, index) => (
                        <Card key={index} style={styles.contactCard}>
                            <List.Item
                                title={contact.name}
                                description={`${contact.phone} • ${contact.email}`}
                                left={props => <Avatar.Text {...props} size={40} label={contact.name.substring(0, 2).toUpperCase()} />}
                                right={props => <IconButton {...props} icon="phone" onPress={() => { }} />}
                            />
                        </Card>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Button
                        mode="contained"
                        icon="message"
                        onPress={() => { }}
                        style={styles.actionButton}
                        contentStyle={styles.actionButtonContent}
                        disabled={job.status === JobStatus.SUBMITTED}
                    >
                        Message Vendor
                    </Button>
                    <Button
                        mode="outlined"
                        icon="pencil"
                        onPress={() => { }}
                        style={styles.secondaryButton}
                        disabled={job.status !== JobStatus.SUBMITTED}
                    >
                        Modify Request
                    </Button>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F2F5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    headerSurface: {
        padding: 20,
        backgroundColor: '#fff',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    headerInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    jobIdText: {
        color: '#666',
        letterSpacing: 1,
    },
    addressTitle: {
        fontWeight: 'bold',
        marginTop: 4,
        color: '#1A1A1A',
        maxWidth: width * 0.6,
    },
    statusChip: {
        borderRadius: 8,
        height: 32,
    },
    statusChipText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    headerDivider: {
        marginVertical: 16,
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 24,
    },
    section: {
        padding: 20,
        paddingBottom: 0,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#1A1A1A',
    },
    contentCard: {
        borderRadius: 16,
        backgroundColor: '#fff',
    },
    descriptionText: {
        lineHeight: 22,
        color: '#444',
    },
    innerDivider: {
        marginVertical: 12,
    },
    subLabel: {
        color: '#999',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    photoList: {
        flexDirection: 'row',
    },
    photoCard: {
        width: 120,
        height: 120,
        marginRight: 12,
        borderRadius: 12,
        overflow: 'hidden',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    noPhotoCard: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        backgroundColor: '#fff',
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#ccc',
    },
    noPhotoContent: {
        alignItems: 'center',
    },
    contactCard: {
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    footer: {
        padding: 20,
        paddingBottom: 40,
        gap: 12,
    },
    actionButton: {
        borderRadius: 12,
        elevation: 0,
    },
    actionButtonContent: {
        height: 48,
    },
    secondaryButton: {
        borderRadius: 12,
        borderWidth: 1.5,
    },
});

export default JobDetailsScreen;
