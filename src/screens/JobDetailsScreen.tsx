import * as React from 'react';
import { View, ScrollView, StyleSheet, Image, Dimensions } from 'react-native';
import { Text, Card, Button, Avatar, Divider, List, Chip, Surface, IconButton, ProgressBar, TextInput } from 'react-native-paper';
import { useJobs } from '../context/JobContext';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList, JobStatus, Urgency, User } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type JobDetailsRouteProp = RouteProp<RootStackParamList, 'JobDetails'>;

const { width } = Dimensions.get('window');

const JobDetailsScreen: React.FC = () => {
    const route = useRoute<JobDetailsRouteProp>();
    const navigation = useNavigation();
    const { getJobById, assignVendor, acceptJob, completeSale } = useJobs();
    const { user, getApprovedVendors } = useAuth();
    const { jobId } = route.params;

    const [approvedVendors, setApprovedVendors] = React.useState<User[]>([]);
    const [notes, setNotes] = React.useState<any[]>([]);
    const [noteContent, setNoteContent] = React.useState('');
    const [isAssigning, setIsAssigning] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const job = getJobById(jobId);

    React.useEffect(() => {
        if (user?.role === 'Admin') {
            getApprovedVendors().then(setApprovedVendors);
        }
    }, [user, getApprovedVendors]);

    const fetchNotes = React.useCallback(async () => {
        try {
            const fetchedNotes = await jobService.getNotes(jobId);
            setNotes(Array.isArray(fetchedNotes) ? fetchedNotes : []);
        } catch (error) {
            console.error('Error fetching notes:', error);
            setNotes([]);
        }
    }, [jobId]);

    React.useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    if (!job) {
        return (
            <View style={styles.centered}>
                <Avatar.Icon size={80} icon="alert-circle-outline" style={{ backgroundColor: '#FEF2F2' }} color="#EF4444" />
                <Text variant="headlineSmall" style={{ marginTop: 16, fontWeight: '900' }}>Job not found</Text>
                <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 24, borderRadius: 12 }}>
                    Go Back
                </Button>
            </View>
        );
    }

    const getStatusStyle = (status: string) => {
        switch (status) {
            case JobStatus.SUBMITTED: return { color: '#6366F1', bg: '#EEF2FF', icon: 'send-circle-outline' };
            case JobStatus.ASSIGNED: return { color: '#8B5CF6', bg: '#F5F3FF', icon: 'account-arrow-right-outline' };
            case JobStatus.ACCEPTED: return { color: '#3B82F6', bg: '#EFF6FF', icon: 'check-circle-outline' };
            case JobStatus.SALE: return { color: '#10B981', bg: '#ECFDF5', icon: 'currency-usd' };
            case JobStatus.COMPLETED: return { color: '#059669', bg: '#ECFDF5', icon: 'flag-checkered' };
            default: return { color: '#64748B', bg: '#F1F5F9', icon: 'help-circle-outline' };
        }
    };

    const handleAddNote = async () => {
        if (!noteContent.trim()) return;
        try {
            await jobService.addNote(jobId, noteContent);
            setNoteContent('');
            fetchNotes();
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const statusStyle = getStatusStyle(job.status);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <Surface style={styles.headerSurface} elevation={0}>
                    <View style={styles.headerTop}>
                        <IconButton
                            icon="chevron-left"
                            mode="contained"
                            containerColor="#F1F5F9"
                            size={24}
                            onPress={() => navigation.goBack()}
                        />
                        <Text variant="titleMedium" style={styles.headerTitle}>Order Pipeline</Text>
                        <IconButton
                            icon="dots-vertical"
                            mode="contained"
                            containerColor="#F1F5F9"
                            size={24}
                        />
                    </View>

                    <View style={styles.heroSection}>
                        <View style={styles.heroInfo}>
                            <Text variant="labelSmall" style={styles.idLabel}>ORDER #{(job.id || '').substring(0, 8).toUpperCase()}</Text>
                            <Text variant="headlineSmall" style={styles.addressTitle}>{job.address}</Text>
                        </View>
                        <Chip
                            icon={statusStyle.icon}
                            style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}
                            textStyle={[styles.statusChipText, { color: statusStyle.color }]}
                        >
                            {job.status}
                        </Chip>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <Avatar.Icon size={32} icon="calendar-clock" style={styles.metaIcon} color="#94A3B8" />
                            <View>
                                <Text variant="labelSmall" style={styles.metaLabel}>CREATED</Text>
                                <Text variant="labelLarge" style={styles.metaValue}>{new Date(job.createdAt).toLocaleDateString()}</Text>
                            </View>
                        </View>
                        <View style={styles.metaItem}>
                            <Avatar.Icon size={32} icon="alert-decagram-outline" style={styles.metaIcon} color={job.urgency === Urgency.IMMEDIATE ? '#EF4444' : '#94A3B8'} />
                            <View>
                                <Text variant="labelSmall" style={styles.metaLabel}>PRIORITY</Text>
                                <Text variant="labelLarge" style={[styles.metaValue, job.urgency === Urgency.IMMEDIATE && { color: '#EF4444' }]}>{job.urgency}</Text>
                            </View>
                        </View>
                    </View>
                </Surface>

                <View style={styles.contentBody}>
                    {user?.role === 'Admin' && job.status === JobStatus.SUBMITTED && (
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Assign to Vendor</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, paddingHorizontal: 24 }}>
                                {approvedVendors.map(vendor => (
                                    <Surface key={vendor.id} style={styles.vendorPickerCard} elevation={1}>
                                        <Avatar.Text size={40} label={vendor.name?.[0] || 'V'} style={{ backgroundColor: '#EEF2FF' }} color="#6366F1" />
                                        <Text variant="labelLarge" style={{ marginTop: 8, fontWeight: 'bold' }}>{vendor.name || 'Vendor'}</Text>
                                        <Button
                                            mode="contained"
                                            compact
                                            onPress={() => assignVendor(job.id, vendor.id!)}
                                            style={{ marginTop: 8, borderRadius: 8 }}
                                        >
                                            Assign
                                        </Button>
                                    </Surface>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Scope of Work</Text>
                        <Card style={styles.descriptionCard} elevation={0}>
                            <Card.Content>
                                <Text variant="bodyLarge" style={styles.descriptionText}>
                                    {job.description}
                                </Text>
                                {job.otherDetails && (
                                    <View style={styles.otherDetailsBox}>
                                        <Text variant="labelSmall" style={styles.subLabel}>ADDITIONAL NOTES</Text>
                                        <Text variant="bodyMedium" style={{ color: '#475569' }}>{job.otherDetails}</Text>
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    </View>

                    {/* Job Photos Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Job Documentation</Text>
                        <Surface style={styles.photosBox} elevation={0}>
                            {job.photos && job.photos.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    {job.photos.map((uri, index) => uri ? (
                                        <View key={index} style={styles.photoWrapper}>
                                            <Image source={{ uri }} style={styles.photoThumbnail} />
                                        </View>
                                    ) : null)}
                                </ScrollView>
                            ) : (
                                <View style={styles.emptyPhotoContent}>
                                    <IconButton icon="image-off-outline" size={32} iconColor="#CBD5E1" />
                                    <Text variant="bodySmall" style={{ color: '#94A3B8' }}>No photos provided for this request.</Text>
                                </View>
                            )}
                        </Surface>
                    </View>

                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Portal Notes</Text>
                        <Surface style={styles.notesBox} elevation={0}>
                            <View style={styles.notesList}>
                                {Array.isArray(notes) && notes.length > 0 ? (
                                    notes.map(note => {
                                        const date = new Date(note.createdAt);
                                        const dateString = isNaN(date.getTime()) ? 'Recent' : date.toLocaleDateString();

                                        return (
                                            <View key={note.id} style={styles.noteItem}>
                                                <View style={styles.noteHeader}>
                                                    <Avatar.Text
                                                        size={20}
                                                        label={String(note.authorId || 'S').substring(0, 2).toUpperCase()}
                                                        style={{ backgroundColor: '#F1F5F9' }}
                                                        labelStyle={{ fontSize: 10, color: '#64748B' }}
                                                    />
                                                    <Text variant="labelSmall" style={styles.noteDate}>
                                                        {dateString}
                                                    </Text>
                                                </View>
                                                <Text variant="bodyMedium" style={styles.noteContent}>{note.content || ''}</Text>
                                            </View>
                                        );
                                    })
                                ) : (
                                    <View style={styles.emptyNotes}>
                                        <Text variant="bodySmall" style={{ color: '#94A3B8', textAlign: 'center' }}>No notes in this portal yet.</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.addNoteContainer}>
                                <TextInput
                                    placeholder="Add a progress update..."
                                    value={noteContent}
                                    onChangeText={setNoteContent}
                                    mode="outlined"
                                    style={styles.noteInput}
                                    multiline
                                    dense
                                    outlineColor="#E2E8F0"
                                    activeOutlineColor="#6366F1"
                                    right={
                                        <TextInput.Icon
                                            icon="send"
                                            disabled={!noteContent.trim()}
                                            onPress={handleAddNote}
                                            color={noteContent.trim() ? "#6366F1" : "#CBD5E1"}
                                        />
                                    }
                                />
                            </View>
                        </Surface>
                    </View>

                    {/* Point of Contact Section */}
                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Contact & Stakeholders</Text>

                        {/* Customer Profile */}
                        <Surface style={styles.contactCard} elevation={0}>
                            <View style={styles.contactRow}>
                                <Avatar.Text
                                    size={48}
                                    label={(job.customer?.name || 'CU').substring(0, 2).toUpperCase()}
                                    style={styles.contactAvatar}
                                />
                                <View style={styles.contactInfo}>
                                    <Text variant="titleMedium" style={styles.contactName}>
                                        {job.customer?.name && job.customer.name !== 'Homeowner' ? job.customer.name : 'Homeowner Profile'}
                                    </Text>
                                    <Text variant="labelSmall" style={styles.contactType}>Homeowner Profile</Text>
                                    <View style={{ marginTop: 4 }}>
                                        <Text variant="bodySmall" style={{ color: '#64748B' }}>
                                            {job.customer?.phone || 'No phone provided'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: '#64748B' }}>
                                            {job.customer?.email || 'No email provided'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </Surface>

                        {/* On-site Details (if different or assigned) */}
                        {(job.contactPhone || job.contactEmail) && (
                            <Surface style={[styles.contactCard, { marginTop: 12, backgroundColor: '#F8FAFC' }]} elevation={0}>
                                <View style={styles.contactRow}>
                                    <Avatar.Icon size={48} icon="account-tie-outline" style={{ backgroundColor: '#EEF2FF' }} color="#6366F1" />
                                    <View style={styles.contactInfo}>
                                        <Text variant="titleMedium" style={styles.contactName}>On-site Contact</Text>
                                        <Text variant="labelSmall" style={styles.contactType}>Specific Point of Contact</Text>
                                        <View style={{ marginTop: 4 }}>
                                            <Text variant="bodySmall" style={{ color: '#6366F1', fontWeight: 'bold' }}>{job.contactPhone}</Text>
                                            <Text variant="bodySmall" style={{ color: '#64748B' }}>{job.contactEmail}</Text>
                                        </View>
                                    </View>
                                </View>
                            </Surface>
                        )}

                        {/* Assigned Vendor Profile */}
                        {job.vendor && (
                            <Surface style={[styles.contactCard, { marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#10B981' }]} elevation={0}>
                                <View style={styles.contactRow}>
                                    <Avatar.Text size={48} label={(job.vendor?.name || 'VN').substring(0, 2).toUpperCase()} style={{ backgroundColor: '#ECFDF5' }} color="#10B981" />
                                    <View style={styles.contactInfo}>
                                        <Text variant="titleMedium" style={styles.contactName}>{job.vendor?.name}</Text>
                                        <Text variant="labelSmall" style={styles.contactType}>Assigned Vendor</Text>
                                        <View style={{ marginTop: 4 }}>
                                            <Text variant="bodySmall" style={{ color: '#059669', fontWeight: 'bold' }}>{job.vendor?.phone || 'No phone'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </Surface>
                        )}
                    </View>

                    {/* Padding for footer */}
                    <View style={{ height: 100 }} />
                </View>
            </ScrollView>

            <View style={styles.footerActions}>
                {user?.role === 'Vendor' && job.status === JobStatus.ASSIGNED && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        onPress={() => acceptJob(job.id)}
                    >
                        Accept This Order
                    </Button>
                )}
                {user?.role === 'Vendor' && job.status === JobStatus.ACCEPTED && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#10B981"
                        onPress={() => completeSale(job.id, {
                            scopeOfWork: job.description,
                            contractAmount: 1500,
                            workStartDate: new Date().toISOString()
                        })}
                    >
                        Mark as Sale
                    </Button>
                )}
                {job.status === JobStatus.SALE && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#000"
                        onPress={() => { }}
                    >
                        View Sale Contract
                    </Button>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    headerSurface: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerTitle: {
        fontWeight: '900',
        color: '#1E293B',
    },
    heroSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    heroInfo: {
        flex: 1,
    },
    idLabel: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    addressTitle: {
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 4,
        letterSpacing: -0.5,
    },
    statusChip: {
        borderRadius: 12,
        height: 32,
    },
    statusChipText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    metaIcon: {
        backgroundColor: '#F8FAFC',
        margin: 0,
    },
    metaLabel: {
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    metaValue: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    contentBody: {
        padding: 24,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 16,
    },
    descriptionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    descriptionText: {
        color: '#475569',
        lineHeight: 24,
    },
    notesBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
    },
    notesList: {
        maxHeight: 300,
        padding: 16,
    },
    noteItem: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    noteContent: {
        color: '#1E293B',
        lineHeight: 20,
    },
    noteDate: {
        color: '#94A3B8',
        fontSize: 10,
    },
    emptyNotes: {
        paddingVertical: 20,
    },
    addNoteContainer: {
        padding: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    noteInput: {
        backgroundColor: '#FFFFFF',
        fontSize: 14,
    },
    photosBox: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        minHeight: 120,
        justifyContent: 'center',
    },
    photoList: {
        flexDirection: 'row',
    },
    photoWrapper: {
        marginRight: 12,
    },
    photoThumbnail: {
        width: 120,
        height: 120,
        borderRadius: 16,
        backgroundColor: '#F1F5F9',
    },
    emptyPhotoContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    vendorPickerCard: {
        width: 140,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        marginRight: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    otherDetailsBox: {
        marginTop: 20,
        paddingTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    subLabel: {
        color: '#94A3B8',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    contactCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    contactAvatar: {
        backgroundColor: '#6366F1',
    },
    contactInfo: {
        flex: 1,
        marginLeft: 16,
    },
    contactName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    contactType: {
        color: '#94A3B8',
    },
    contactActions: {
        flexDirection: 'row',
        gap: 4,
    },
    footerActions: {
        padding: 24,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        position: 'absolute',
        bottom: 0,
        width: '100%',
    },
    mainActionBtn: {
        borderRadius: 16,
    },
});

export default JobDetailsScreen;
