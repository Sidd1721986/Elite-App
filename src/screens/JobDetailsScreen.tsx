import * as React from 'react';
import { View, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Text, Card, Button, Avatar, Divider, List, Chip, Surface, IconButton, ProgressBar, TextInput, Menu, Portal } from 'react-native-paper';
import { useJobs } from '../context/JobContext';
import { useAuth } from '../context/AuthContext';
import { jobService } from '../services/jobService';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import DocumentPicker, { types } from 'react-native-document-picker';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList, JobStatus, Urgency, User } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type JobDetailsRouteProp = RouteProp<RootStackParamList, 'JobDetails'>;

/** Admin may force Completed when a vendor is assigned but has not finalized (matches server rules). */
function adminMayMarkVendorJobComplete(job: { vendorId?: string; status?: string }): boolean {
    if (!job?.vendorId) {return false;}
    const s = (job.status || '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) {return false;}
    const blocked = new Set([
        'completed',
        'invoiced',
        'invoicerequested',
        'submitted',
        'assigned',
        'expired',
    ]);
    if (blocked.has(s)) {return false;}
    const eligible = new Set(['sale', 'followup', 'accepted', 'reachedout', 'apptset']);
    return eligible.has(s);
}

const getStatusStyle = (status: string) => {
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

const JobDetailsScreen: React.FC = () => {
    const route = useRoute<JobDetailsRouteProp>();
    const navigation = useNavigation();
    const { getJobById, assignVendor, acceptJob, completeSale, reachOut, setAppointment, completeJob, requestInvoice, uploadInvoice, addJobPhotos, removeJobPhoto } = useJobs();
    const { user, getApprovedVendors } = useAuth();
    const jobId = route.params?.jobId;

    const [approvedVendors, setApprovedVendors] = React.useState<User[]>([]);
    const [notes, setNotes] = React.useState<any[]>([]);
    const [noteContent, setNoteContent] = React.useState('');
    const [invoiceUrl, setInvoiceUrl] = React.useState('');
    const [newPhotoUrl, setNewPhotoUrl] = React.useState('');
    const [showPhotoInput, setShowPhotoInput] = React.useState(false);
    const [isAsssignedVendorsLoading, setIsAssignedVendorsLoading] = React.useState(false);
    const [showAddPhotoMenu, setShowAddPhotoMenu] = React.useState(false);
    const [isDeletingPhoto, setIsDeletingPhoto] = React.useState<string | null>(null);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState(0);
    const [isProcessing, setIsProcessing] = React.useState(false);

    const job = jobId ? getJobById(jobId) : undefined;

    React.useEffect(() => {
        if (user?.role === 'Admin') {
            getApprovedVendors().then(setApprovedVendors);
        }
    }, [user, getApprovedVendors]);

    React.useEffect(() => {
        if (user?.role === 'Vendor') {
            setShowAddPhotoMenu(false);
            setShowPhotoInput(false);
        }
    }, [user?.role]);

    const fetchNotes = React.useCallback(async () => {
        if (!jobId) {return;}
        try {
            const fetchedNotes = await jobService.getNotes(jobId);
            setNotes(Array.isArray(fetchedNotes) ? fetchedNotes : []);
        } catch (error) {
            console.error('Error fetching notes:', error);
            setNotes([]);
        }
    }, [jobId]);

    React.useEffect(() => {
        if (jobId) {fetchNotes();}
    }, [fetchNotes, jobId]);

    const statusStyle = React.useMemo(() => getStatusStyle(job?.status ?? ''), [job?.status]);

    if (!jobId) {
        return (
            <View style={styles.centered}>
                <Text variant="headlineSmall" style={{ fontWeight: '900' }}>Missing job</Text>
                <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 24, borderRadius: 12 }}>
                    Go Back
                </Button>
            </View>
        );
    }

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



    const handleAddNote = async () => {
        if (!noteContent.trim()) {return;}
        try {
            await jobService.addNote(jobId, noteContent);
            setNoteContent('');
            fetchNotes();
        } catch (error) {
            console.error('Error adding note:', error);
        }
    };

    const handlePhotoUpload = async (type: 'camera' | 'library') => {
        if (user?.role === 'Vendor') {return;}
        setShowAddPhotoMenu(false);
        const options = {
            mediaType: 'photo' as const,
            quality: 0.8 as const,
        };

        const result = type === 'camera'
            ? await launchCamera(options)
            : await launchImageLibrary(options);

        if (result.assets && result.assets[0]) {
            const asset = result.assets[0];
            setIsUploading(true);
            setUploadProgress(0.3);

            try {
                const fileToUpload = {
                    uri: asset.uri,
                    type: asset.type || 'image/jpeg',
                    name: asset.fileName || 'upload.jpg',
                };

                const uploadResult = await jobService.uploadFile(fileToUpload);
                if (uploadResult && uploadResult.url) {
                    setUploadProgress(0.8);
                    await addJobPhotos(job.id, [uploadResult.url]);
                    setUploadProgress(1);
                }
            } catch (error) {
                console.error('Photo upload failed:', error);
            } finally {
                setIsUploading(false);
                setUploadProgress(0);
            }
        }
    };

    const handleDeletePhoto = async (photoUrl: string) => {
        if (user?.role === 'Vendor') {return;}
        setIsDeletingPhoto(photoUrl);
        try {
            await removeJobPhoto(job.id, photoUrl);
        } catch (error) {
            console.error('Error deleting photo:', error);
        } finally {
            setIsDeletingPhoto(null);
        }
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.pickSingle({
                type: [types.pdf, types.images, types.doc, types.docx],
                copyTo: 'cachesDirectory',
            });

            setIsUploading(true);
            setUploadProgress(0.5);

            const fileToUpload = {
                uri: result.fileCopyUri || result.uri,
                type: result.type || 'application/pdf',
                name: result.name || 'document.pdf',
            };

            const uploadResult = await jobService.uploadFile(fileToUpload);
            if (uploadResult && uploadResult.url) {
                setUploadProgress(1);
                await uploadInvoice(job.id, uploadResult.url);
            }
        } catch (err) {
            if (DocumentPicker.isCancel(err)) {
                // User cancelled
            } else {
                console.error('Document pick error:', err);
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    /** Camera / gallery pick for the invoice section (uploads file then submits invoice URL). */
    const handleInvoiceImagePick = async (type: 'camera' | 'library') => {
        const options = {
            mediaType: 'photo' as const,
            quality: 0.8 as const,
        };
        const result =
            type === 'camera' ? await launchCamera(options) : await launchImageLibrary(options);

        if (!result.assets?.[0]) {return;}

        const asset = result.assets[0];
        setIsUploading(true);
        setUploadProgress(0.3);
        try {
            const fileToUpload = {
                uri: asset.uri,
                type: asset.type || 'image/jpeg',
                name: asset.fileName || 'invoice.jpg',
            };
            const uploadResult = await jobService.uploadFile(fileToUpload);
            if (uploadResult?.url) {
                setUploadProgress(0.8);
                await uploadInvoice(job.id, uploadResult.url);
                setUploadProgress(1);
            }
        } catch (error) {
            console.error('Invoice image upload failed:', error);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };


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
                            <Text variant="labelSmall" style={styles.idLabel}>ORDER #{job.jobNumber}{job.jobSuffix || ''}</Text>
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

                {/* Invoicing Section for Vendor */}
                {user?.role === 'Vendor' && job.status === JobStatus.INVOICE_REQUESTED && (
                    <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Submit Invoice Document</Text>
                        <Surface style={styles.invoiceUploadBox} elevation={0}>
                            {isUploading ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <ProgressBar progress={uploadProgress} color="#6366F1" style={{ width: '100%', height: 8, borderRadius: 4 }} />
                                    <Text variant="labelMedium" style={{ marginTop: 12, color: '#64748B' }}>Uploading invoice document...</Text>
                                </View>
                            ) : (
                                <View>
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <Button
                                            mode="contained"
                                            style={{ flex: 1, borderRadius: 12, backgroundColor: '#6366F1' }}
                                            icon="camera"
                                            onPress={() => handleInvoiceImagePick('camera')}
                                        >
                                            Take Photo
                                        </Button>
                                        <Button
                                            mode="contained"
                                            style={{ flex: 1, borderRadius: 12, backgroundColor: '#0F172A' }}
                                            icon="file-image-outline"
                                            onPress={() => handleInvoiceImagePick('library')}
                                        >
                                            Gallery
                                        </Button>
                                    </View>
                                    <View style={{ marginTop: 12 }}>
                                        <Button
                                            mode="outlined"
                                            style={{ borderRadius: 12, borderColor: '#CBD5E1' }}
                                            icon="file-document-outline"
                                            onPress={handlePickDocument}
                                        >
                                            Browse Files (PDF/Docs)
                                        </Button>
                                    </View>
                                    <Divider style={{ marginVertical: 16 }} />
                                    <TextInput
                                        placeholder="Or paste external link..."
                                        value={invoiceUrl}
                                        onChangeText={setInvoiceUrl}
                                        mode="outlined"
                                        dense
                                        style={styles.noteInput}
                                        outlineColor="#E2E8F0"
                                        activeOutlineColor="#6366F1"
                                    />
                                    {invoiceUrl.trim().length > 0 && (
                                        <Button
                                            mode="text"
                                            onPress={async () => {
                                                setIsProcessing(true);
                                                try {
                                                    await uploadInvoice(job.id, invoiceUrl);
                                                    setInvoiceUrl('');
                                                } catch (e) { console.error(e); }
                                                finally { setIsProcessing(false); }
                                            }}
                                        >
                                            Submit manual link
                                        </Button>
                                    )}
                                </View>
                            )}
                        </Surface>
                    </View>
                )}

                {/* View Invoice Section */}
                {job.invoiceDocumentUrl && (
                    <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Financial Documents</Text>
                        <Surface style={styles.contactCard} elevation={0}>
                            <View style={styles.contactRow}>
                                <Avatar.Icon size={48} icon="file-pdf-box" style={{ backgroundColor: '#FEF2F2' }} color="#EF4444" />
                                <View style={styles.contactInfo}>
                                    <Text variant="titleMedium" style={styles.contactName}>Job Invoice</Text>
                                    <Text variant="labelSmall" style={styles.contactType}>Document uploaded by vendor</Text>
                                </View>
                                <Button
                                    mode="outlined"
                                    icon="open-in-new"
                                    onPress={() => job.invoiceDocumentUrl && Linking.openURL(job.invoiceDocumentUrl)}
                                    style={{ borderRadius: 12 }}
                                >
                                    View
                                </Button>
                            </View>
                        </Surface>
                    </View>
                )}

                <View style={styles.contentBody}>
                    {user?.role === 'Admin' && (!job.items || (Array.isArray(job.items) && job.items.some(i => i && !i.isAssigned))) && job.status !== JobStatus.COMPLETED && (
                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text variant="titleMedium" style={[styles.sectionTitle, { marginBottom: 0 }]}>
                                    Assign Work
                                </Text>
                                <Button
                                    mode="contained"
                                    compact
                                    onPress={() => (navigation as any).navigate('AssignVendor', { jobId: job.id })}
                                    style={{ borderRadius: 8 }}
                                >
                                    Split & Assign
                                </Button>
                            </View>
                            <Surface style={styles.infoCard} elevation={0}>
                                <Text variant="bodySmall" style={{ color: '#64748B' }}>
                                    You can split this request and assign different items to different specialized vendors.
                                </Text>
                            </Surface>
                        </View>
                    )}

                    {/* Child Jobs (Assignments) list for Parent Job */}
                    {job.childJobs && job.childJobs.length > 0 && (
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Scope Assignments</Text>
                            {job.childJobs.map((child) => (
                                <Surface key={child.id} style={styles.assignmentCard} elevation={1}>
                                    <View style={styles.assignmentTop}>
                                        <Text variant="labelSmall" style={styles.assignmentId}>PART #{child.jobNumber}{child.jobSuffix}</Text>
                                        <Chip compact style={[styles.statusChip, { height: 20, backgroundColor: getStatusStyle(child.status).bg }]} textStyle={{ fontSize: 9, color: getStatusStyle(child.status).color }}>
                                            {child.status}
                                        </Chip>
                                    </View>
                                    <Text variant="bodyMedium" style={styles.assignmentDesc}>{child.description}</Text>
                                    <Divider style={{ marginVertical: 8 }} />
                                    <View style={styles.assignmentBottom}>
                                        <View style={styles.vendorMiniLink}>
                                            <Avatar.Icon size={20} icon="account-hard-hat" style={{ backgroundColor: '#F1F5F9' }} color="#64748B" />
                                            <Text variant="labelMedium" style={{ marginLeft: 8, color: '#475569' }}>
                                                {child.vendor?.name || 'Unassigned'}
                                            </Text>
                                        </View>
                                        <Button
                                            mode="text"
                                            compact
                                            labelStyle={{ fontSize: 11 }}
                                            onPress={() => (navigation as any).navigate('JobDetails', { jobId: child.id })}
                                        >
                                            View Part
                                        </Button>
                                    </View>
                                </Surface>
                            ))}
                        </View>
                    )}

                    <View style={styles.section}>
                        <Text variant="titleMedium" style={styles.sectionTitle}>Scope of Work</Text>
                        <Card style={styles.descriptionCard} elevation={0}>
                            <Card.Content>
                                {Array.isArray(job.items) && job.items.length > 0 ? (
                                    <View style={{ marginBottom: 12 }}>
                                        {job.items.map((item, idx) => item && (
                                            <View key={item.id || idx} style={[styles.itemDetailRow, idx < job.items!.length - 1 && styles.itemSeparator]}>
                                                <View style={styles.itemTitleRow}>
                                                    <Text variant="titleSmall" style={styles.itemTitleText}>{item.title}</Text>
                                                    {item.isAssigned && (
                                                        <Chip compact style={{ height: 20, backgroundColor: '#ECFDF5' }} textStyle={{ fontSize: 9, color: '#059669' }}>Assigned</Chip>
                                                    )}
                                                </View>
                                                <Text variant="bodyMedium" style={styles.itemDescriptionText}>{item.description}</Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <>
                                        {job.services && job.services.length > 0 && (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                                                {job.services.map(s => (
                                                    <View key={s} style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#DDE3FF' }}>
                                                        <Text style={{ fontSize: 11, color: '#6366F1', fontWeight: 'bold', textTransform: 'uppercase' }}>{s}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        <Text variant="bodyLarge" style={styles.descriptionText}>
                                            {job.description}
                                        </Text>
                                    </>
                                )}

                                {job.otherDetails && (
                                    <View style={styles.otherDetailsBox}>
                                        <Text variant="labelSmall" style={styles.subLabel}>ADDITIONAL NOTES</Text>
                                        <Text variant="bodyMedium" style={{ color: '#475569' }}>{job.otherDetails}</Text>
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    </View>

                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text variant="titleMedium" style={[styles.sectionTitle, { marginBottom: 0 }]}>Request Photos</Text>
                            {user?.role !== 'Vendor' && (
                                <Menu
                                    visible={showAddPhotoMenu}
                                    onDismiss={() => setShowAddPhotoMenu(false)}
                                    anchor={
                                        <Button
                                            mode="text"
                                            compact
                                            icon="plus-circle-outline"
                                            onPress={() => setShowAddPhotoMenu(true)}
                                            textColor="#6366F1"
                                            loading={isUploading}
                                        >
                                            Add Photo
                                        </Button>
                                    }
                                >
                                    <Menu.Item leadingIcon="camera" onPress={() => handlePhotoUpload('camera')} title="Take Photo" />
                                    <Menu.Item leadingIcon="image" onPress={() => handlePhotoUpload('library')} title="Gallery" />
                                    <Menu.Item leadingIcon="link" onPress={() => setShowPhotoInput(true)} title="Paste Link" />
                                </Menu>
                            )}
                        </View>
                        <Surface style={styles.photosBox} elevation={0}>
                            {isUploading && (
                                <View style={{ padding: 12 }}>
                                    <ProgressBar progress={uploadProgress} color="#6366F1" style={{ height: 4, borderRadius: 2 }} />
                                    <Text variant="labelSmall" style={{ marginTop: 4, textAlign: 'center', color: '#64748B' }}>Sharing photo...</Text>
                                </View>
                            )}
                            {showPhotoInput && !isUploading && user?.role !== 'Vendor' && (
                                <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 12 }}>
                                    <TextInput
                                        placeholder="Paste image URL here..."
                                        value={newPhotoUrl}
                                        onChangeText={setNewPhotoUrl}
                                        mode="outlined"
                                        style={{ backgroundColor: '#FFF', fontSize: 13 }}
                                        dense
                                        outlineColor="#E2E8F0"
                                        activeOutlineColor="#6366F1"
                                        right={
                                            <TextInput.Icon
                                                icon="send"
                                                onPress={async () => {
                                                    if (!newPhotoUrl.trim()) {return;}
                                                    setIsProcessing(true);
                                                    try {
                                                        await addJobPhotos(job.id, [newPhotoUrl]);
                                                        setNewPhotoUrl('');
                                                        setShowPhotoInput(false);
                                                    } catch (e) { console.error(e); }
                                                    finally { setIsProcessing(false); }
                                                }}
                                                disabled={!newPhotoUrl.trim() || isProcessing}
                                            />
                                        }
                                        left={<TextInput.Icon icon="close" onPress={() => setShowPhotoInput(false)} />}
                                    />
                                </View>
                            )}
                            {job.photos && job.photos.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    {job.photos.map((uri, index) => uri ? (
                                        <View key={uri} style={styles.photoWrapper}>
                                            <FastImage
                                                source={{ uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
                                                style={styles.photoThumbnail}
                                                resizeMode={FastImage.resizeMode.cover}
                                            />
                                            {user?.role !== 'Vendor' && (
                                                <IconButton
                                                    icon="close-circle"
                                                    size={20}
                                                    iconColor="#EF4444"
                                                    style={styles.deletePhotoBtn}
                                                    onPress={() => handleDeletePhoto(uri)}
                                                    loading={isDeletingPhoto === uri}
                                                    disabled={!!isDeletingPhoto}
                                                />
                                            )}
                                        </View>
                                    ) : null)}
                                </ScrollView>
                            ) : (
                                !isUploading && (
                                    <View style={styles.emptyPhotoContent}>
                                        <IconButton icon="image-off-outline" size={32} iconColor="#CBD5E1" />
                                        <Text variant="bodySmall" style={{ color: '#94A3B8' }}>No photos provided for this request.</Text>
                                    </View>
                                )
                            )}
                        </Surface>
                    </View>

                    {/* Completion Photos Section */}
                    {job.completedPhotos && job.completedPhotos.length > 0 && (
                        <View style={styles.section}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Completed Work Photos</Text>
                            <Surface style={[styles.photosBox, { borderColor: '#10B98120', backgroundColor: '#F0FDF430' }]} elevation={0}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    {job.completedPhotos.map((uri, index) => uri ? (
                                        <View key={uri} style={styles.photoWrapper}>
                                            <FastImage
                                                source={{ uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
                                                style={[styles.photoThumbnail, { borderColor: '#10B981' }]}
                                                resizeMode={FastImage.resizeMode.cover}
                                            />
                                        </View>
                                    ) : null)}
                                </ScrollView>
                            </Surface>
                        </View>
                    )}


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
                                            color={noteContent.trim() ? '#6366F1' : '#CBD5E1'}
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
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Button
                            mode="outlined"
                            style={[styles.mainActionBtn, { flex: 1, borderColor: '#6366F1' }]}
                            contentStyle={{ height: 56 }}
                            textColor="#6366F1"
                            icon="message-outline"
                            onPress={() => (navigation as any).navigate('Chat', { otherUserId: 'admin', otherUserName: 'Elite Admin' })}
                        >
                            Message Admin
                        </Button>
                        <Button
                            mode="contained"
                            style={[styles.mainActionBtn, { flex: 1 }]}
                            contentStyle={{ height: 56 }}
                            onPress={async () => {
                                setIsProcessing(true);
                                try {
                                    await acceptJob(job.id);
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            loading={isProcessing}
                        >
                            Accept Order
                        </Button>
                    </View>
                )}
                {user?.role === 'Vendor' && job.status === JobStatus.ACCEPTED && (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Button
                            mode="contained"
                            style={[styles.mainActionBtn, { flex: 1 }]}
                            contentStyle={{ height: 56 }}
                            buttonColor="#F59E0B"
                            icon="phone-outline"
                            onPress={async () => {
                                setIsProcessing(true);
                                try {
                                    await reachOut(job.id);
                                    // Removed goBack() to show the updated status in-place
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            loading={isProcessing}
                        >
                            Reached Out
                        </Button>
                        <Button
                            mode="contained"
                            style={[styles.mainActionBtn, { flex: 1 }]}
                            contentStyle={{ height: 56 }}
                            buttonColor="#10B981"
                            icon="currency-usd"
                            onPress={async () => {
                                setIsProcessing(true);
                                try {
                                    await completeSale(job.id, {
                                        scopeOfWork: job.description,
                                        contractAmount: 1500,
                                        workStartDate: new Date().toISOString(),
                                    });
                                } catch (e) {
                                    console.error(e);
                                } finally {
                                    setIsProcessing(false);
                                }
                            }}
                            loading={isProcessing}
                        >
                            Mark as Sale
                        </Button>
                    </View>
                )}
                {user?.role === 'Vendor' && job.status === 'ReachedOut' && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#EC4899"
                        icon="calendar-clock"
                        onPress={async () => {
                            setIsProcessing(true);
                            try {
                                await setAppointment(job.id);
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                    >
                        Set Appointment
                    </Button>
                )}
                {user?.role === 'Vendor' && job.status === 'ApptSet' && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#10B981"
                        icon="currency-usd"
                        onPress={async () => {
                            setIsProcessing(true);
                            try {
                                await completeSale(job.id, {
                                    scopeOfWork: job.description,
                                    contractAmount: 1500,
                                    workStartDate: new Date().toISOString(),
                                });
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                        loading={isProcessing}
                    >
                        Submit Sale
                    </Button>
                )}
                {user?.role === 'Vendor' && job.status === JobStatus.SALE && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#059669"
                        icon="check-decagram"
                        onPress={async () => {
                            setIsProcessing(true);
                            try {
                                await completeJob(job.id, []);
                            } catch (e) {
                                console.error(e);
                            } finally {
                                setIsProcessing(false);
                            }
                        }}
                    >
                        Finalize & Complete
                    </Button>
                )}
                {user?.role === 'Admin' && adminMayMarkVendorJobComplete(job) && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#059669"
                        icon="check-decagram"
                        loading={isProcessing}
                        onPress={() => {
                            Alert.alert(
                                'Mark job complete',
                                'Move this job to Completed? Use this when the work is done but the vendor forgot to tap “Finalize & Complete”.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Mark complete',
                                        style: 'default',
                                        onPress: async () => {
                                            setIsProcessing(true);
                                            try {
                                                await completeJob(job.id, []);
                                            } catch (e) {
                                                console.error(e);
                                                Alert.alert('Error', 'Could not mark the job complete. Please try again.');
                                            } finally {
                                                setIsProcessing(false);
                                            }
                                        },
                                    },
                                ],
                            );
                        }}
                    >
                        Mark complete (vendor missed)
                    </Button>
                )}
                {user?.role === 'Admin' && job.status === JobStatus.COMPLETED && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#6366F1"
                        icon="file-document-outline"
                        onPress={async () => {
                            setIsProcessing(true);
                            try {
                                await requestInvoice(job.id);
                            } catch (e) { console.error(e); }
                            finally { setIsProcessing(false); }
                        }}
                        loading={isProcessing}
                    >
                        Request Vendor Invoice
                    </Button>
                )}
                {job.status === JobStatus.INVOICE_REQUESTED && user?.role === 'Admin' && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#F97316"
                        disabled
                    >
                        Pending Vendor Response
                    </Button>
                )}
                {job.status === JobStatus.INVOICED && (
                    <Button
                        mode="contained"
                        style={styles.mainActionBtn}
                        contentStyle={{ height: 56 }}
                        buttonColor="#000"
                        onPress={() => { }}
                    >
                        Order Archived & Invoiced
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
    invoiceUploadBox: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
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
        position: 'relative',
    },
    deletePhotoBtn: {
        position: 'absolute',
        top: -8,
        right: -8,
        backgroundColor: '#FFFFFF',
        margin: 0,
        zIndex: 10,
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
    itemDetailRow: {
        paddingVertical: 12,
    },
    itemSeparator: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    itemTitleText: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    itemDescriptionText: {
        color: '#475569',
    },
    infoCard: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
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
    assignmentCard: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    assignmentTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    assignmentId: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    assignmentDesc: {
        color: '#1E293B',
        lineHeight: 20,
        marginBottom: 4,
    },
    assignmentBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    vendorMiniLink: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default JobDetailsScreen;
