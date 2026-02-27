import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, FlatList, RefreshControl, Image, ScrollView, Dimensions } from 'react-native';
import {
    Text, Card, Button, Avatar, Divider, Surface,
    Portal, Modal, TextInput, List, IconButton,
    Chip, Checkbox,
    Menu, SegmentedButtons, Snackbar,
    ProgressBar
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, JobStatus, Urgency, Job } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import JobItem from '../components/JobItem';
import { launchImageLibrary } from 'react-native-image-picker';

type NavigationProp = StackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

const CustomerDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { jobs, addJob, updateJob, getJobById, refreshJobs } = useJobs();
    const navigation = useNavigation<NavigationProp>();

    // UI States
    const [isNewJobModalVisible, setNewJobModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('active');
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshJobs();
        setRefreshing(false);
    }, [refreshJobs]);

    // Form States for New Job
    const [address, setAddress] = useState(user?.address || '');
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState<Urgency>(Urgency.NO_RUSH);
    const [otherDetails, setOtherDetails] = useState('');
    const [contactPhone, setContactPhone] = useState(user?.phone || '');
    const [contactEmail, setContactEmail] = useState(user?.email || '');
    const [photos, setPhotos] = useState<string[]>([]);
    const [showUrgencyMenu, setShowUrgencyMenu] = useState(false);

    const handleLogout = useCallback(async () => {
        await logout();
    }, [logout]);

    const handlePickImage = useCallback(async () => {
        const result = await launchImageLibrary({
            mediaType: 'photo',
            selectionLimit: 5,
            includeBase64: false,
        });

        if (result.assets) {
            const uris = result.assets.map(asset => asset.uri).filter(Boolean) as string[];
            setPhotos(prev => [...prev, ...uris]);
        }
    }, []);

    const clearForm = useCallback(() => {
        setDescription('');
        setOtherDetails('');
        setUrgency(Urgency.NO_RUSH);
        setPhotos([]);
        setEditingJobId(null);
        setAddress(user?.address || '');
        setContactPhone(user?.phone || '');
        setContactEmail(user?.email || '');
    }, [user?.address, user?.phone, user?.email]);

    const handleSubmitJob = useCallback(async () => {
        if (!address.trim() || !description.trim() || !contactPhone.trim() || !contactEmail.trim()) {
            setSnackbarMessage('Please fill in all mandatory fields (Address, Description, Phone, and Email)');
            setSnackbarVisible(true);
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            setSnackbarMessage('Please enter a valid email address');
            setSnackbarVisible(true);
            return;
        }

        try {
            if (editingJobId) {
                await updateJob(editingJobId, {
                    address: address,
                    description,
                    photos: photos,
                    urgency,
                    otherDetails,
                    contactPhone,
                    contactEmail,
                });
                setSnackbarMessage('Job request updated successfully!');
            } else {
                await addJob({
                    customerId: user?.email || 'anon',
                    address: address,
                    description,
                    photos: photos,
                    urgency,
                    otherDetails,
                    contactPhone,
                    contactEmail,
                });
                setSnackbarMessage('Job request submitted successfully!');
            }

            setSnackbarVisible(true);
            setNewJobModalVisible(false);
            clearForm();
            // Refresh jobs to ensure dashboard stats and list are updated
            await refreshJobs();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save job request';
            setSnackbarMessage(errorMessage);
            setSnackbarVisible(true);
        }
    }, [address, description, addJob, updateJob, user, urgency, otherDetails, photos, editingJobId, clearForm, contactPhone, contactEmail]);

    const handleViewDetails = useCallback((jobId: string) => {
        navigation.navigate('JobDetails', { jobId });
    }, [navigation]);

    const handleModifyJob = useCallback((jobId: string) => {
        const jobToEdit = getJobById(jobId);
        if (jobToEdit) {
            setEditingJobId(jobId);
            setAddress(jobToEdit.address);
            setDescription(jobToEdit.description);
            setUrgency(jobToEdit.urgency);
            setOtherDetails(jobToEdit.otherDetails || '');
            setContactPhone(jobToEdit.contactPhone || '');
            setContactEmail(jobToEdit.contactEmail || '');
            setPhotos(jobToEdit.photos || []);
            setNewJobModalVisible(true);
        }
    }, [getJobById]);

    const activeJobs = useMemo(() =>
        jobs.filter(j => j.status !== JobStatus.COMPLETED && j.status !== JobStatus.INVOICED),
        [jobs]);

    const historyJobs = useMemo(() =>
        jobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.INVOICED),
        [jobs]);

    const renderJobItem = useCallback(({ item }: { item: Job }) => (
        <JobItem
            job={item}
            onViewDetails={handleViewDetails}
            onModify={handleModifyJob}
        />
    ), [handleViewDetails, handleModifyJob]);

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            <Surface style={styles.header} elevation={0}>
                <View style={styles.headerTop}>
                    <Surface style={styles.headerLogoSurface} elevation={1}>
                        <Image
                            source={require('../assets/logo.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                    </Surface>
                    <IconButton
                        icon="power"
                        mode="contained"
                        containerColor="#FEF2F2"
                        iconColor="#EF4444"
                        size={22}
                        onPress={handleLogout}
                        style={styles.headerLogout}
                    />
                </View>

                <View style={styles.welcomeSection}>
                    <Text variant="headlineSmall" style={styles.welcomeText}>Hello, {user?.name?.split(' ')[0] || 'Member'}</Text>
                    <Text variant="labelMedium" style={styles.headerSubtitle}>Ready to fix something today?</Text>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text variant="titleLarge" style={styles.statValue}>{activeJobs.length}</Text>
                        <Text variant="labelSmall" style={styles.statLabel}>Active Jobs</Text>
                    </View>
                    <Divider style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text variant="titleLarge" style={styles.statValue}>{historyJobs.length}</Text>
                        <Text variant="labelSmall" style={styles.statLabel}>Completed</Text>
                    </View>

                </View>
            </Surface>

            <SegmentedButtons
                value={activeTab}
                onValueChange={setActiveTab}
                buttons={[
                    { value: 'active', label: 'Dashboard', icon: 'view-dashboard-outline' },
                    { value: 'explore', label: 'Explore', icon: 'compass-outline' },
                    { value: 'profile', label: 'Account', icon: 'account-outline' },
                ]}
                style={styles.segmentedButtons}
            />
        </View>
    );

    const renderActiveTab = () => (
        <FlatList
            data={activeJobs}
            keyExtractor={item => item.id}
            renderItem={renderJobItem}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListHeaderComponent={() => (
                <View style={styles.tabHeader}>
                    <Surface style={styles.bannerSurface} elevation={3}>
                        <View style={styles.bannerTextContainer}>
                            <Text variant="titleLarge" style={styles.bannerTitle}>Need a professional?</Text>
                            <Text variant="bodyMedium" style={styles.bannerText}>Get your job started in seconds.</Text>
                            <Button
                                mode="contained"
                                icon="plus"
                                style={styles.newJobBtn}
                                labelStyle={{ fontWeight: '900' }}
                                onPress={() => {
                                    clearForm();
                                    setNewJobModalVisible(true);
                                }}
                            >
                                Request Service
                            </Button>
                        </View>
                        <Image
                            source={require('../assets/logo.png')}
                            style={styles.bannerImage}
                            resizeMode="contain"
                        />
                    </Surface>

                    {activeJobs.length > 0 && (
                        <View style={styles.sectionHeader}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>
                                Ongoing Projects
                            </Text>
                            <Button mode="text" compact labelStyle={{ fontSize: 12 }}>View All</Button>
                        </View>
                    )}
                </View>
            )}
            ListFooterComponent={() => (
                historyJobs.length > 0 ? (
                    <View style={styles.historySection}>
                        <View style={styles.sectionHeader}>
                            <Text variant="titleMedium" style={styles.sectionTitle}>Recent History</Text>
                            <Button mode="text" compact labelStyle={{ fontSize: 12 }}>Full Report</Button>
                        </View>
                        {historyJobs.slice(0, 3).map(item => (
                            <JobItem
                                key={item.id}
                                job={item}
                                onViewDetails={handleViewDetails}
                            />
                        ))}
                    </View>
                ) : null
            )}
            ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                    <IconButton icon="hammer-wrench" size={48} iconColor="#E2E8F0" />
                    <Text variant="bodyLarge" style={styles.emptyText}>Ready to start your first project?</Text>
                </View>
            )}
            contentContainerStyle={styles.tabContent}
        />
    );

    const renderExploreTab = () => (
        <ScrollView
            contentContainerStyle={styles.tabContent}
            showsVerticalScrollIndicator={false}
        >
            <Text variant="headlineSmall" style={styles.tabTitle}>Exclusive Services</Text>

            <View style={styles.serviceGrid}>
                {[
                    { title: 'Plumbing', icon: 'water-outline', color: '#3B82F6' },
                    { title: 'Electrical', icon: 'lightning-bolt-outline', color: '#F59E0B' },
                    { title: 'HVAC', icon: 'air-conditioner', color: '#10B981' },
                    { title: 'Remodeling', icon: 'home-edit-outline', color: '#6366F1' },
                ].map((s, i) => (
                    <Surface key={i} style={styles.serviceItem} elevation={1}>
                        <IconButton icon={s.icon} iconColor={s.color} mode="contained" containerColor={`${s.color}10`} />
                        <Text variant="labelLarge" style={styles.serviceText}>{s.title}</Text>
                    </Surface>
                ))}
            </View>

            <View style={styles.upsellBanner}>
                <Surface style={styles.upsellInner} elevation={0}>
                    <View style={styles.upsellText}>
                        <Text variant="titleMedium" style={styles.upsellTitle}>Elite Concierge</Text>
                        <Text variant="bodySmall" style={styles.upsellDesc}>Priority 24/7 support and guaranteed same-day response.</Text>
                    </View>
                    <Button mode="contained" buttonColor="#000" style={styles.upsellBtn}>Upgrade</Button>
                </Surface>
            </View>

            <Text variant="titleMedium" style={styles.sectionTitle}>Trusted Partners</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {[1, 2, 3, 4].map(v => (
                    <Surface key={v} style={styles.vendorCard} elevation={1}>
                        <Avatar.Text size={48} label={`V${v}`} style={{ backgroundColor: '#EEF2FF' }} labelStyle={{ color: '#6366F1' }} />
                        <Text variant="labelLarge" style={styles.vendorName}>QuickFix Pro {v}</Text>
                        <View style={styles.ratingRow}>
                            <IconButton icon="star" iconColor="#F59E0B" size={14} style={{ margin: 0 }} />
                            <Text variant="labelSmall">4.9</Text>
                        </View>
                    </Surface>
                ))}
            </ScrollView>
        </ScrollView>
    );

    const renderProfileTab = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            <Surface style={styles.profileHeader} elevation={2}>
                <Avatar.Text
                    size={80}
                    label={user?.name?.substring(0, 2).toUpperCase() || 'E'}
                    style={{ backgroundColor: '#6366F1' }}
                />
                <Text variant="headlineSmall" style={styles.profileName}>{user?.name || 'Valued Member'}</Text>
                <Text variant="bodyMedium" style={styles.profileEmail}>{user?.email}</Text>

                <View style={styles.badgeRow}>
                    <Chip compact icon="star" style={styles.badgeChip}>Elite Gold</Chip>
                    <Chip compact icon="shield-check" style={styles.badgeChip}>Verified</Chip>
                </View>
            </Surface>

            <View style={styles.menuSection}>
                <List.Item
                    title="Edit Profile"
                    left={props => <List.Icon {...props} icon="account-edit-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Primary Address"
                    description={user?.address || 'Set your primary address'}
                    left={props => <List.Icon {...props} icon="map-marker-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Payment Methods"
                    left={props => <List.Icon {...props} icon="credit-card-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Security & Privacy"
                    left={props => <List.Icon {...props} icon="shield-lock-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
            </View>

            <Button
                mode="outlined"
                onPress={handleLogout}
                style={styles.logoutBtn}
                textColor="#EF4444"
                icon="logout"
            >
                Log Out
            </Button>
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderHeader()}

            <View style={{ flex: 1 }}>
                {activeTab === 'active' && renderActiveTab()}
                {activeTab === 'explore' && renderExploreTab()}
                {activeTab === 'profile' && renderProfileTab()}
            </View>

            <Portal>
                <Modal
                    visible={isNewJobModalVisible}
                    onDismiss={() => {
                        setNewJobModalVisible(false);
                        clearForm();
                    }}
                    contentContainerStyle={styles.modalContent}
                >
                    <Text variant="headlineSmall" style={styles.modalTitle}>
                        {editingJobId ? 'Modify Request' : 'Request Service'}
                    </Text>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <TextInput
                            label="Service Address *"
                            value={address}
                            onChangeText={setAddress}
                            mode="outlined"
                            style={styles.modalInput}
                            left={<TextInput.Icon icon="map-marker-outline" />}
                        />

                        <TextInput
                            label="Description of Work *"
                            value={description}
                            onChangeText={setDescription}
                            mode="outlined"
                            style={styles.modalInput}
                            multiline
                            numberOfLines={4}
                            placeholder="e.g. Living room faucet is leaking..."
                        />

                        <TextInput
                            label="On-site Contact Phone *"
                            value={contactPhone}
                            onChangeText={setContactPhone}
                            mode="outlined"
                            style={styles.modalInput}
                            keyboardType="phone-pad"
                        />

                        <TextInput
                            label="On-site Contact Email *"
                            value={contactEmail}
                            onChangeText={setContactEmail}
                            mode="outlined"
                            style={styles.modalInput}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <View style={styles.formRow}>
                            <Text variant="labelLarge" style={styles.formLabel}>Urgency Level</Text>
                            <Menu
                                visible={showUrgencyMenu}
                                onDismiss={() => setShowUrgencyMenu(false)}
                                anchor={
                                    <Button
                                        mode="outlined"
                                        onPress={() => setShowUrgencyMenu(true)}
                                        style={styles.urgencyBtn}
                                        icon="chevron-down"
                                        contentStyle={{ flexDirection: 'row-reverse' }}
                                    >
                                        {urgency}
                                    </Button>
                                }>
                                {Object.values(Urgency).map((u) => (
                                    <Menu.Item
                                        key={u}
                                        onPress={() => {
                                            setUrgency(u);
                                            setShowUrgencyMenu(false);
                                        }}
                                        title={u}
                                    />
                                ))}
                            </Menu>
                        </View>

                        <TextInput
                            label="Additional Notes"
                            value={otherDetails}
                            onChangeText={setOtherDetails}
                            mode="outlined"
                            style={styles.modalInput}
                        />

                        <View style={styles.photoSection}>
                            <View style={styles.photoHeader}>
                                <Text variant="labelLarge" style={styles.formLabel}>Work Photos</Text>
                                <Button
                                    mode="text"
                                    compact
                                    icon="camera-plus"
                                    onPress={handlePickImage}
                                >
                                    Add Pictures
                                </Button>
                            </View>
                            {photos.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    {photos.map((uri, index) => (
                                        <View key={index} style={styles.photoWrapper}>
                                            <Image source={{ uri }} style={styles.photoThumbnail} />
                                            <IconButton
                                                icon="close-circle"
                                                size={20}
                                                iconColor="#EF4444"
                                                style={styles.removePhotoBtn}
                                                onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                                            />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <Surface style={styles.emptyPhotoBox} elevation={0}>
                                    <IconButton icon="image-plus" size={32} iconColor="#CBD5E1" />
                                    <Text variant="bodySmall" style={{ color: '#94A3B8' }}>No photos added yet</Text>
                                </Surface>
                            )}
                        </View>

                        <Button
                            mode="contained"
                            onPress={handleSubmitJob}
                            style={styles.submitBtn}
                            contentStyle={{ height: 50 }}
                        >
                            {editingJobId ? 'Save Changes' : 'Submit Request'}
                        </Button>
                        <Button
                            mode="text"
                            onPress={() => {
                                setNewJobModalVisible(false);
                                clearForm();
                            }}
                            style={{ marginTop: 8 }}
                        >
                            Cancel
                        </Button>
                    </ScrollView>
                </Modal>
            </Portal>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={styles.snackbar}
            >
                {snackbarMessage}
            </Snackbar>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 5,
        zIndex: 10,
    },
    header: {
        padding: 24,
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    headerLogout: {
        margin: 0,
        marginRight: -12,
    },
    welcomeSection: {
        marginBottom: 24,
    },
    headerLogoSurface: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    headerLogo: {
        width: 32,
        height: 32,
    },
    welcomeText: {
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: '#64748B',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontWeight: '900',
        color: '#6366F1',
    },
    statLabel: {
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginTop: 2,
    },
    statDivider: {
        height: 24,
        width: 1,
        backgroundColor: '#E2E8F0',
    },
    segmentedButtons: {
        marginHorizontal: 24,
        marginBottom: 20,
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        borderWidth: 0,
    },
    tabContent: {
        padding: 24,
        paddingBottom: 100,
    },
    tabHeader: {
        marginBottom: 16,
    },
    bannerSurface: {
        backgroundColor: '#6366F1',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        overflow: 'hidden',
    },
    bannerTextContainer: {
        flex: 1,
    },
    bannerTitle: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    bannerText: {
        color: '#E0E7FF',
        marginBottom: 16,
    },
    newJobBtn: {
        backgroundColor: '#F59E0B',
        alignSelf: 'flex-start',
        borderRadius: 12,
    },
    bannerImage: {
        width: 100,
        height: 100,
        opacity: 0.2,
        position: 'absolute',
        right: -20,
        bottom: -20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    historySection: {
        marginTop: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#94A3B8',
        marginTop: 16,
    },
    tabTitle: {
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 24,
    },
    serviceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 32,
    },
    serviceItem: {
        width: (width - 64) / 2,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    serviceText: {
        marginTop: 8,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    upsellBanner: {
        marginBottom: 32,
    },
    upsellInner: {
        backgroundColor: '#F59E0B',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    upsellText: {
        flex: 1,
        marginRight: 16,
    },
    upsellTitle: {
        fontWeight: 'bold',
        color: '#000',
    },
    upsellDesc: {
        color: '#000',
        opacity: 0.7,
    },
    upsellBtn: {
        borderRadius: 12,
        height: 40,
    },
    horizontalScroll: {
        paddingBottom: 8,
    },
    vendorCard: {
        width: 140,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        marginRight: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    vendorName: {
        marginTop: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1E293B',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    profileHeader: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 24,
    },
    profileName: {
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 16,
    },
    profileEmail: {
        color: '#64748B',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    badgeChip: {
        backgroundColor: '#F1F5F9',
    },
    menuSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 24,
    },
    logoutBtn: {
        borderRadius: 16,
        borderColor: '#EF4444',
        marginBottom: 40,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        margin: 20,
        borderRadius: 32,
        maxHeight: '80%',
    },
    modalTitle: {
        fontWeight: '900',
        marginBottom: 20,
        textAlign: 'center',
    },
    modalInput: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    formRow: {
        marginBottom: 24,
    },
    formLabel: {
        marginBottom: 8,
        color: '#64748B',
    },
    urgencyBtn: {
        borderRadius: 12,
    },
    submitBtn: {
        marginTop: 8,
        borderRadius: 16,
    },
    snackbar: {
        borderRadius: 12,
        backgroundColor: '#1E293B',
    },
    photoSection: {
        marginBottom: 24,
    },
    photoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    photoList: {
        flexDirection: 'row',
        marginTop: 8,
    },
    photoWrapper: {
        position: 'relative',
        marginRight: 12,
    },
    photoThumbnail: {
        width: 100,
        height: 100,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    removePhotoBtn: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#FFFFFF',
        margin: 0,
    },
    emptyPhotoBox: {
        height: 100,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
});

export default CustomerDashboard;
