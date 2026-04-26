import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, RefreshControl, ScrollView, useWindowDimensions, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';

const FlashListCompat = FlashList as any;
import FastImage from 'react-native-fast-image';
import {
    Text, Card, Button, Avatar, Divider, Surface,
    Portal, Modal, TextInput, List, IconButton,
    Chip,
    Menu, SegmentedButtons, Snackbar,
    ProgressBar, Dialog,
} from 'react-native-paper';
import { MotiView, MotiText } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import AppLogo from '../components/AppLogo';
import { useNavigation } from '@react-navigation/native';
import { useChatInboxNotifications } from '../hooks/useChatInboxNotifications';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, JobStatus, Urgency, Job } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import JobItem from '../components/JobItem';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { JobSkeleton, DashboardStatsSkeleton } from '../components/SkeletonLoader';
import { formatAddress, parseAddress, US_STATES } from '../utils/addressUtils';
import { AVAILABLE_SERVICES } from '../config/services';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const UserDashboard: React.FC = () => {
    const { width: windowWidth } = useWindowDimensions();
    const reducedMotion = useReducedMotion();
    const { user, logout } = useAuth();
    const { jobs, addJob, updateJob, getJobById, refreshJobs, isLoading } = useJobs();
    const { messageUnreadTotal, refreshInbox } = useChatInboxNotifications();
    const navigation = useNavigation<NavigationProp>();

    const isCustomer = useMemo(() => {
        if (!user?.role) {return false;}
        const role = user.role.toLowerCase();
        return role !== 'admin' && role !== 'vendor';
    }, [user?.role]);

    // UI States
    const [isNewJobModalVisible, setNewJobModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('active');
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [settingsMenuVisible, setSettingsMenuVisible] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refreshJobs(), refreshInbox()]);
        setRefreshing(false);
    }, [refreshJobs, refreshInbox]);

    // Form States for New Job
    const [street, setStreet] = useState('');
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');
    const [state, setState] = useState('');
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState<Urgency>(Urgency.NO_RUSH);
    const [otherDetails, setOtherDetails] = useState('');
    const [contactPhone, setContactPhone] = useState(user?.phone || '');
    const [contactEmail, setContactEmail] = useState(user?.email || '');
    const [photos, setPhotos] = useState<string[]>([]);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);

    // Auto-populate description from selected services
    React.useEffect(() => {
        if (selectedServices.length > 0) {
            setDescription(selectedServices.join(', '));
        } else {
            setDescription('');
        }
    }, [selectedServices]);

    const [showUrgencyMenu, setShowUrgencyMenu] = useState(false);
    const [showStateMenu, setShowStateMenu] = useState(false);
    const [showServicesMenu, setShowServicesMenu] = useState(false);
    const [showPhotoMenu, setShowPhotoMenu] = useState(false);

    const handleLogout = useCallback(async () => {
        setSettingsMenuVisible(false);
        await logout();
    }, [logout]);


    const handlePickImage = useCallback(async () => {
        setShowPhotoMenu(false);
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

    const handleTakePhoto = useCallback(async () => {
        setShowPhotoMenu(false);
        const result = await launchCamera({
            mediaType: 'photo',
            saveToPhotos: true,
            quality: 0.8,
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
        setSelectedServices([]);
        setEditingJobId(null);

        const parts = parseAddress(user?.address);
        setStreet(parts.street);
        setCity(parts.city);
        setZip(parts.zip);
        setState(parts.state);

        setContactPhone(user?.phone || '');
        setContactEmail(user?.email || '');
    }, [user]);

    const handleSubmitJob = useCallback(async () => {
        const address = formatAddress({ street, city, zip, state });

        const missingFields = [];
        if (!street.trim()) {missingFields.push('Address');}
        if (!city.trim()) {missingFields.push('City');}
        if (!zip.trim()) {missingFields.push('Zip');}
        if (!state.trim()) {missingFields.push('State');}
        if (selectedServices.length === 0) {missingFields.push('Services');}
        if (!description.trim()) {missingFields.push('What\'s needs fixing');}
        if (!contactPhone.trim()) {missingFields.push('Contact Phone');}
        if (!contactEmail.trim()) {missingFields.push('Contact Email');}

        if (missingFields.length > 0) {
            setSnackbarMessage(`Missing: ${missingFields.join(', ')}`);
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

        if (!isCustomer) {
            setSnackbarMessage('Error: Only User accounts can create service requests.');
            setSnackbarVisible(true);
            return;
        }

        try {
            if (editingJobId) {
                await updateJob(editingJobId, {
                    address: address,
                    description,
                    photos: photos,
                    services: selectedServices,
                    urgency,
                    otherDetails,
                    contactPhone,
                    contactEmail,
                });
                setSnackbarMessage('Job request updated successfully!');
            } else {
                await addJob({
                    customerId: user?.id || user?.email || 'anon',
                    address: address,
                    description,
                    photos: photos,
                    services: selectedServices,
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
    }, [street, city, zip, state, description, addJob, updateJob, user, urgency, otherDetails, photos, editingJobId, clearForm, contactPhone, contactEmail]);

    const handleViewDetails = useCallback((jobId: string) => {
        navigation.navigate('JobDetails', { jobId });
    }, [navigation]);

    const handleModifyJob = useCallback((jobId: string) => {
        const jobToEdit = getJobById(jobId);
        if (jobToEdit) {
            setEditingJobId(jobId);
            const parts = parseAddress(jobToEdit.address);
            setStreet(parts.street);
            setCity(parts.city);
            setZip(parts.zip);
            setState(parts.state);
            setDescription(jobToEdit.description);
            setUrgency(jobToEdit.urgency);
            setOtherDetails(jobToEdit.otherDetails || '');
            setContactPhone(jobToEdit.contactPhone || '');
            setContactEmail(jobToEdit.contactEmail || '');
            setPhotos(jobToEdit.photos || []);
            setSelectedServices(jobToEdit.services || []);
            setDescription(jobToEdit.description || '');
            setNewJobModalVisible(true);
        }
    }, [getJobById]);

    const activeJobs = useMemo(() =>
        jobs.filter(j => j.status !== JobStatus.COMPLETED && j.status !== JobStatus.INVOICED),
        [jobs]);

    const historyJobs = useMemo(() =>
        jobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.INVOICED),
        [jobs]);

    // Pre-slice to avoid recomputing inside ListFooterComponent on every render
    const recentHistoryJobs = useMemo(() => historyJobs.slice(0, 3), [historyJobs]);

    const renderJobItem = useCallback(({ item, index }: { item: Job, index: number }) => (
        <JobItem
            job={item}
            onViewDetails={handleViewDetails}
            onModify={handleModifyJob}
            index={index}
        />
    ), [handleViewDetails, handleModifyJob]);

    const renderHeader = useCallback(() => (
        <View style={styles.headerContainer}>
            <Surface style={styles.header} elevation={0}>
                <View style={styles.headerTop}>
                    <Surface style={styles.headerLogoSurface} elevation={1}>
                        <AppLogo size={36} showSurface={false} />
                    </Surface>
                    <View style={styles.headerActions}>
                        <View style={styles.chatIconWrap}>
                            <IconButton
                                icon="message-text-outline"
                                iconColor="#6366F1"
                                mode="contained"
                                containerColor="#EEF2FF"
                                size={22}
                                onPress={() =>
                                    navigation.navigate('Chat', {
                                        otherUserId: 'admin',
                                        otherUserName: 'Elite Admin',
                                    })
                                }
                                accessibilityLabel="Messages with Elite Admin"
                            />
                            {messageUnreadTotal > 0 ? (
                                <View style={styles.chatBadge} pointerEvents="none">
                                    <Text style={styles.chatBadgeText}>
                                        {messageUnreadTotal > 99 ? '99+' : String(messageUnreadTotal)}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <Menu
                            visible={settingsMenuVisible}
                            onDismiss={() => setSettingsMenuVisible(false)}
                            anchor={
                                <IconButton
                                    icon="menu"
                                    mode="contained"
                                    containerColor="#F1F5F9"
                                    size={24}
                                    onPress={() => setSettingsMenuVisible(true)}
                                />
                            }
                        >
                            <Menu.Item
                                leadingIcon="account-circle-outline"
                                onPress={() => { setSettingsMenuVisible(false); navigation.navigate('Profile'); }}
                                title="Profile Settings"
                            />
                            <Menu.Item
                                leadingIcon="information-outline"
                                onPress={() => { setSettingsMenuVisible(false); navigation.navigate('AccountDetails'); }}
                                title="Account Details"
                            />
                            <Divider />
                            <Menu.Item
                                leadingIcon="logout"
                                onPress={handleLogout}
                                title="Logout"
                            />
                        </Menu>
                    </View>
                </View>

                <MotiView
                    from={reducedMotion ? { opacity: 1, translateX: 0 } : { opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: reducedMotion ? 0 : 600 }}
                    style={styles.welcomeSection}
                >
                    <Text variant="headlineSmall" style={styles.welcomeText}>Hello, {user?.name?.split(' ')[0] || 'Member'}</Text>
                    <Text variant="labelMedium" style={styles.headerSubtitle}>Ready to fix something today?</Text>
                </MotiView>

                {isLoading ? (
                    <DashboardStatsSkeleton />
                ) : (
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
                )}
            </Surface>

            <SegmentedButtons
                value={activeTab}
                onValueChange={setActiveTab}
                buttons={[
                    { value: 'active', label: 'Dashboard', icon: 'view-dashboard-outline' },
                    { value: 'profile', label: 'Account', icon: 'account-outline' },
                ]}
                style={styles.segmentedButtons}
            />
        </View>
    ), [user, activeTab, settingsMenuVisible, handleLogout, navigation, messageUnreadTotal]);

    // Memoised FlashList sub-components — stable references prevent unnecessary
    // FlashList re-renders when unrelated state (e.g. settingsMenu) changes.
    const ListHeader = useCallback(() => (
        <View style={styles.tabHeader}>
            <MotiView
                from={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', delay: reducedMotion ? 0 : 200 }}
                style={styles.bannerSurface}
            >
                <View style={styles.bannerTextContainer}>
                    {!isCustomer && (
                        <Chip icon="eye-outline" style={{ marginBottom: 8, alignSelf: 'flex-start' }}>Preview Mode</Chip>
                    )}
                    <Text variant="titleLarge" style={styles.bannerTitle}>
                        {isCustomer ? 'How can we help today?' : 'Service Request Preview'}
                    </Text>
                    <Text variant="bodyMedium" style={styles.bannerText}>
                        {isCustomer
                            ? 'Describe your needs and we\'ll assign the best experts for the job.'
                            : 'This is a preview of the user request flow. Only User accounts can create requests.'
                        }
                    </Text>
                    {isCustomer && (
                        <Button
                            mode="contained"
                            icon="plus"
                            style={styles.newJobBtn}
                            labelStyle={{ fontWeight: '900' }}
                            onPress={() => { clearForm(); setNewJobModalVisible(true); }}
                        >
                            Request Service
                        </Button>
                    )}
                </View>
                <AppLogo size={80} showSurface={false} />
            </MotiView>

            {isLoading ? (
                <View style={{ marginTop: 20 }}>
                    <JobSkeleton />
                    <JobSkeleton />
                    <JobSkeleton />
                </View>
            ) : activeJobs.length > 0 ? (
                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Ongoing Projects</Text>
                    <Button mode="text" compact labelStyle={{ fontSize: 12 }}>View All</Button>
                </View>
            ) : null}
        </View>
    ), [isCustomer, isLoading, activeJobs.length, clearForm, reducedMotion]);

    const ListFooter = useCallback(() => (
        recentHistoryJobs.length > 0 ? (
            <View style={styles.historySection}>
                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Recent History</Text>
                    <Button mode="text" compact labelStyle={{ fontSize: 12 }}>Full Report</Button>
                </View>
                {recentHistoryJobs.map(item => (
                    <JobItem key={item.id} job={item} onViewDetails={handleViewDetails} />
                ))}
            </View>
        ) : null
    ), [recentHistoryJobs, handleViewDetails]);

    const ListEmpty = useCallback(() => (
        <View style={styles.emptyContainer}>
            <IconButton icon="hammer-wrench" size={48} iconColor="#E2E8F0" />
            <Text variant="bodyLarge" style={styles.emptyText}>Ready to start your first project?</Text>
        </View>
    ), []);

    const renderActiveTab = useCallback(() => (
        <View style={{ flex: 1 }}>
            <FlashListCompat
                data={isLoading ? [] : activeJobs}
                keyExtractor={(item: Job) => item.id}
                renderItem={renderJobItem}
                estimatedItemSize={250}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                ListEmptyComponent={ListEmpty}
                contentContainerStyle={styles.tabContent}
                extraData={[isLoading, activeJobs, refreshing, messageUnreadTotal, recentHistoryJobs]}
            />
        </View>
    ), [isLoading, activeJobs, renderJobItem, ListHeader, ListFooter, ListEmpty, refreshing, messageUnreadTotal, recentHistoryJobs]);


    const renderProfileTab = () => (
        <ScrollView contentContainerStyle={styles.tabContent}>
            <Surface style={styles.profileHeader} elevation={2}>
                <Avatar.Text
                    size={80}
                    label={user?.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'E'}
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
                    onPress={() => navigation.navigate('Profile')}
                    left={props => <List.Icon {...props} icon="account-edit-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Primary Address"
                    description={user?.address || 'Set your primary address'}
                    onPress={() => navigation.navigate('Profile')}
                    left={props => <List.Icon {...props} icon="map-marker-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Security & Privacy"
                    onPress={() => navigation.navigate('PrivacyPolicy')}
                    left={props => <List.Icon {...props} icon="shield-lock-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
                <Divider />
                <List.Item
                    title="Help & Support"
                    onPress={() => navigation.navigate('ContactSupport')}
                    left={props => <List.Icon {...props} icon="help-circle-outline" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                />
            </View>
        </ScrollView>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderHeader()}

            <View style={{ flex: 1 }}>
                {activeTab === 'active' && renderActiveTab()}
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
                        {editingJobId ? 'Edit Service Request' : 'Request Service'}
                    </Text>

                    {!isCustomer && (
                        <Surface style={{ padding: 12, backgroundColor: '#FEF2F2', borderRadius: 12, marginBottom: 16 }}>
                            <Text style={{ color: '#991B1B', fontWeight: 'bold' }}>
                                ⚠️ Admin/Vendor View
                            </Text>
                            <Text style={{ color: '#991B1B', fontSize: 12 }}>
                                You are in a read-only preview. Please login as a User to create requests.
                            </Text>
                        </Surface>
                    )}
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <TextInput
                            label="Service Street Address *"
                            value={street}
                            onChangeText={setStreet}
                            mode="outlined"
                            style={styles.modalInput}
                            left={<TextInput.Icon icon="map-marker-outline" />}
                        />

                        <View style={styles.addressRow}>
                            <TextInput
                                label="City *"
                                value={city}
                                onChangeText={setCity}
                                mode="outlined"
                                style={[styles.modalInput, { flex: 2 }]}
                            />
                            <TextInput
                                label="Zip *"
                                value={zip}
                                onChangeText={setZip}
                                mode="outlined"
                                style={[styles.modalInput, { flex: 1.2 }]}
                                keyboardType="numeric"
                            />
                            <Menu
                                visible={showStateMenu}
                                onDismiss={() => setShowStateMenu(false)}
                                anchor={
                                    <TouchableOpacity
                                        onPress={() => setShowStateMenu(true)}
                                        activeOpacity={1}
                                        style={{ flex: 1 }}
                                    >
                                        <View pointerEvents="none">
                                            <TextInput
                                                label="State *"
                                                value={state}
                                                mode="outlined"
                                                style={styles.modalInput}
                                                right={<TextInput.Icon icon="chevron-down" />}
                                                editable={false}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                }
                            >
                                <ScrollView style={{ maxHeight: 250 }}>
                                    {US_STATES.map((s) => (
                                        <Menu.Item
                                            key={s}
                                            onPress={() => {
                                                setState(s);
                                                setShowStateMenu(false);
                                            }}
                                            title={s}
                                        />
                                    ))}
                                </ScrollView>
                            </Menu>
                        </View>

                        <Text variant="titleSmall" style={styles.sectionLabel}>Select Services Needed *</Text>
                        <Menu
                            visible={showServicesMenu}
                            onDismiss={() => setShowServicesMenu(false)}
                            anchor={
                                <TouchableOpacity
                                    onPress={() => setShowServicesMenu(true)}
                                    activeOpacity={1}
                                >
                                    <View pointerEvents="none">
                                        <TextInput
                                            label="Service Needed *"
                                            value={selectedServices.length > 0 ? `${selectedServices.length} selected` : ''}
                                            mode="outlined"
                                            style={styles.modalInput}
                                            placeholder="Select a service"
                                            editable={false}
                                            right={<TextInput.Icon icon="chevron-down" />}
                                        />
                                    </View>
                                </TouchableOpacity>
                            }
                        >
                            <ScrollView style={{ maxHeight: 260 }}>
                                {AVAILABLE_SERVICES.map((service) => (
                                    <Menu.Item
                                        key={service}
                                        title={service}
                                        leadingIcon={selectedServices.includes(service) ? 'check-circle-outline' : 'plus-circle-outline'}
                                        onPress={() => {
                                            setSelectedServices(prev =>
                                                prev.includes(service) ? prev : [...prev, service]
                                            );
                                            setShowServicesMenu(false);
                                        }}
                                    />
                                ))}
                            </ScrollView>
                        </Menu>

                        <View style={styles.selectedServicesContainer}>
                            {selectedServices.length === 0 ? (
                                <Text variant="bodySmall" style={styles.selectedServicesHint}>
                                    Selected services will appear here.
                                </Text>
                            ) : (
                                selectedServices.map(service => (
                                    <Chip
                                        key={service}
                                        mode="outlined"
                                        compact
                                        style={styles.selectedServiceChip}
                                        textStyle={styles.selectedServiceChipText}
                                        onClose={() => {
                                            setSelectedServices(prev => prev.filter(s => s !== service));
                                        }}
                                    >
                                        {service}
                                    </Chip>
                                ))
                            )}
                        </View>

                        <TextInput
                            label="Summary of Services Needed *"
                            value={description}
                            mode="outlined"
                            style={[styles.modalInput, { backgroundColor: '#F8FAFC' }]}
                            multiline
                            numberOfLines={2}
                            editable={false}
                            placeholder="Select services above to populate this summary..."
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
                                <Menu
                                    visible={showPhotoMenu}
                                    onDismiss={() => setShowPhotoMenu(false)}
                                    anchor={
                                        <Button
                                            mode="text"
                                            compact
                                            icon="camera-plus"
                                            onPress={() => setShowPhotoMenu(true)}
                                        >
                                            Add Pictures
                                        </Button>
                                    }
                                >
                                    <Menu.Item
                                        leadingIcon="camera"
                                        onPress={handleTakePhoto}
                                        title="Take Photo"
                                    />
                                    <Menu.Item
                                        leadingIcon="image-multiple"
                                        onPress={handlePickImage}
                                        title="Choose from Gallery"
                                    />
                                </Menu>
                            </View>
                            {photos.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                    {photos.map((uri, index) => (
                                        <View key={index} style={styles.photoWrapper}>
                                            <FastImage source={{ uri }} style={styles.photoThumbnail} />
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
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    chatIconWrap: {
        position: 'relative',
    },
    chatBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        borderRadius: 9,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
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
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
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
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    addressRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
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
    sectionLabel: {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    selectedServicesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
        minHeight: 32,
    },
    selectedServicesHint: {
        color: '#94A3B8',
        marginBottom: 8,
    },
    selectedServiceChip: {
        backgroundColor: '#EEF2FF',
        borderColor: '#CBD5FF',
    },
    selectedServiceChipText: {
        fontSize: 12,
        color: '#4338CA',
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
        margin: 0,
        backgroundColor: '#FFFFFF',
    },
    itemsSection: {
        marginTop: 16,
        marginBottom: 8,
    },
    itemsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    itemCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    itemNumber: {
        color: '#6366F1',
        fontWeight: 'bold',
    },
    itemInput: {
        backgroundColor: '#FFFFFF',
        marginBottom: 8,
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

export default React.memo(UserDashboard);
