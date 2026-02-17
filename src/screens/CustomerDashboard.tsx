import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, FlatList } from 'react-native';
import {
    Text, Card, Button, Avatar, Divider, Surface,
    Portal, Modal, TextInput, List, IconButton,
    Chip, ProgressBar, MD3Colors, Checkbox,
    Menu, SegmentedButtons, Snackbar
} from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, JobStatus, Urgency, Job, UserRole } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import JobItem from '../components/JobItem';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const CustomerDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { jobs, addJob, updateJob } = useJobs();
    const navigation = useNavigation<NavigationProp>();

    // UI States
    const [isNewJobModalVisible, setNewJobModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('active');
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

    // Form States for New Job
    const [address, setAddress] = useState(user?.address || '');
    const [useSavedAddress, setUseSavedAddress] = useState(true);
    const [description, setDescription] = useState('');
    const [urgency, setUrgency] = useState<Urgency>(Urgency.NO_RUSH);
    const [otherDetails, setOtherDetails] = useState('');
    const [showUrgencyMenu, setShowUrgencyMenu] = useState(false);

    // Charity Settings
    const [selectedCharity, setSelectedCharity] = useState('Meals on Wheels');
    const [showCharityMenu, setShowCharityMenu] = useState(false);

    const charities = ['Meals on Wheels', 'Red Cross', 'WWF', 'Local Pantry', 'Habitat for Humanity'];

    const handleLogout = useCallback(async () => {
        await logout();
    }, [logout]);

    const handleCreateJob = useCallback(async () => {
        if (!address || !description) {
            setSnackbarMessage('Please fill in address and description');
            setSnackbarVisible(true);
            return;
        }

        await addJob({
            customerId: user?.email || 'anon',
            address: address,
            contacts: [{
                name: user?.name || '',
                phone: user?.phone || '',
                email: user?.email || '',
            }],
            description,
            photos: [],
            urgency,
            otherDetails,
        });

        setSnackbarMessage('Job request submitted successfully!');
        setSnackbarVisible(true);
        setNewJobModalVisible(false);
        setDescription('');
        setOtherDetails('');
        setUrgency(Urgency.NO_RUSH);
    }, [address, description, addJob, user, urgency, otherDetails]);

    const handleContactAdmin = useCallback(() => {
        setSnackbarMessage('Message sent to Admin. We will get back to you soon!');
        setSnackbarVisible(true);
    }, []);

    const handleViewDetails = useCallback((jobId: string) => {
        navigation.navigate('JobDetails', { jobId });
    }, [navigation]);

    const handleModifyJob = useCallback((jobId: string) => {
        // Edit logic placeholder
    }, []);

    const activeJobs = useMemo(() =>
        jobs.filter(j => j.status !== JobStatus.COMPLETED_AWAITING_PAYMENT),
        [jobs]);

    const historyJobs = useMemo(() =>
        jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_PAYMENT),
        [jobs]);

    const renderActiveTab = () => (
        <FlatList
            data={activeJobs}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
                <JobItem
                    job={item}
                    onViewDetails={handleViewDetails}
                    onModify={handleModifyJob}
                />
            )}
            ListHeaderComponent={() => (
                <>
                    <Button
                        mode="contained"
                        icon="plus"
                        style={styles.newJobButton}
                        onPress={() => setNewJobModalVisible(true)}
                    >
                        New Job Request
                    </Button>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Current Jobs ({activeJobs.length})
                    </Text>
                </>
            )}
            ListFooterComponent={() => (
                historyJobs.length > 0 ? (
                    <>
                        <Divider style={styles.divider} />
                        <Text variant="titleMedium" style={styles.sectionTitle}>Previous Job History</Text>
                        <FlatList
                            data={historyJobs}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <JobItem
                                    job={item}
                                    onViewDetails={handleViewDetails}
                                />
                            )}
                            scrollEnabled={false}
                        />
                    </>
                ) : null
            )}
            ListEmptyComponent={() => (
                <Text style={styles.emptyText}>No active jobs found.</Text>
            )}
            contentContainerStyle={styles.tabContent}
        />
    );

    const renderExploreTab = () => (
        <FlatList
            data={[]}
            renderItem={null}
            ListHeaderComponent={() => (
                <View style={styles.tabContent}>
                    <Text variant="headlineSmall" style={styles.tabTitle}>How it Works</Text>
                    <Card style={styles.infoCard}>
                        <Card.Content>
                            <Text variant="bodyMedium">
                                Our platform connects you with trusted local vendors.
                                Every job completed through the app contributes to local charities.
                            </Text>
                        </Card.Content>
                    </Card>

                    <Text variant="titleMedium" style={styles.sectionTitle}>Our Trusted Vendors</Text>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={[1, 2, 3]}
                        keyExtractor={item => item.toString()}
                        renderItem={({ item }) => (
                            <Card style={styles.miniCard}>
                                <Avatar.Icon size={40} icon="store" />
                                <Text variant="bodySmall">Vendor {item}</Text>
                            </Card>
                        )}
                        style={styles.horizontalScroll}
                    />

                    <Text variant="titleMedium" style={styles.sectionTitle}>Featured Charities</Text>
                    <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        data={['Red Cross', 'WWF', 'Local Pantry']}
                        keyExtractor={item => item}
                        renderItem={({ item }) => (
                            <Card style={styles.miniCard}>
                                <Avatar.Icon size={40} icon="heart" />
                                <Text variant="bodySmall" style={{ textAlign: 'center' }}>{item}</Text>
                            </Card>
                        )}
                        style={styles.horizontalScroll}
                    />
                </View>
            )}
        />
    );

    const renderMoreTab = () => (
        <View style={styles.tabContent}>
            <Text variant="headlineSmall" style={styles.tabTitle}>Community & Support</Text>

            <List.Section>
                <List.Subheader>Giving Settings</List.Subheader>
                <View style={styles.charitySelector}>
                    <Menu
                        visible={showCharityMenu}
                        onDismiss={() => setShowCharityMenu(false)}
                        anchor={
                            <List.Item
                                title="Preferred Charity"
                                description={selectedCharity}
                                left={props => <List.Icon {...props} icon="heart" />}
                                onPress={() => setShowCharityMenu(true)}
                                right={props => <IconButton {...props} icon="chevron-down" />}
                            />
                        }>
                        {charities.map(c => (
                            <Menu.Item
                                key={c}
                                onPress={() => {
                                    setSelectedCharity(c);
                                    setShowCharityMenu(false);
                                    setSnackbarMessage(`Preferred charity updated to ${c}`);
                                    setSnackbarVisible(true);
                                }}
                                title={c}
                            />
                        ))}
                    </Menu>
                </View>

                <Divider />

                <List.Subheader>Support</List.Subheader>
                <List.Item
                    title="Contact Admin"
                    description="Reach out with questions or feedback"
                    left={props => <List.Icon {...props} icon="help-circle" />}
                    onPress={handleContactAdmin}
                />
                <List.Item
                    title="FAQ"
                    left={props => <List.Icon {...props} icon="frequently-asked-questions" />}
                />
            </List.Section>
        </View>
    );

    const renderNewJobModal = () => (
        <Modal
            visible={isNewJobModalVisible}
            onDismiss={() => setNewJobModalVisible(false)}
            contentContainerStyle={styles.modalContainer}
        >
            <FlatList
                data={[]}
                renderItem={null}
                ListHeaderComponent={() => (
                    <>
                        <Text variant="headlineSmall" style={styles.modalTitle}>New Job Request</Text>

                        <View style={styles.formSection}>
                            <View style={styles.checkboxRow}>
                                <Checkbox
                                    status={useSavedAddress ? 'checked' : 'unchecked'}
                                    onPress={() => {
                                        setUseSavedAddress(!useSavedAddress);
                                        if (!useSavedAddress) setAddress(user?.address || '');
                                    }}
                                />
                                <Text variant="bodyMedium">Use saved address</Text>
                            </View>

                            <TextInput
                                label="Job Address"
                                value={address}
                                onChangeText={setAddress}
                                disabled={useSavedAddress}
                                mode="outlined"
                                style={styles.modalInput}
                            />
                        </View>

                        <TextInput
                            label="Job Description"
                            placeholder="Describe what needs to be done..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                            mode="outlined"
                            style={styles.modalInput}
                        />

                        <View style={styles.dropdownContainer}>
                            <Text variant="labelLarge" style={styles.inputLabel}>Urgency</Text>
                            <Menu
                                visible={showUrgencyMenu}
                                onDismiss={() => setShowUrgencyMenu(false)}
                                anchor={
                                    <Button
                                        mode="outlined"
                                        onPress={() => setShowUrgencyMenu(true)}
                                        style={styles.dropdownButton}
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
                            label="Other Details (Optional)"
                            value={otherDetails}
                            onChangeText={setOtherDetails}
                            mode="outlined"
                            style={styles.modalInput}
                        />

                        <Button
                            mode="outlined"
                            icon="camera"
                            style={styles.photoButton}
                        >
                            Add Photos
                        </Button>

                        <View style={styles.modalActions}>
                            <Button onPress={() => setNewJobModalVisible(false)}>Cancel</Button>
                            <Button mode="contained" onPress={handleCreateJob} style={styles.submitButton}>
                                Submit Request
                            </Button>
                        </View>
                    </>
                )}
            />
        </Modal>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Surface style={styles.header} elevation={1}>
                <View style={styles.userProfile}>
                    <Avatar.Text size={48} label={user?.name?.substring(0, 2).toUpperCase() || 'CU'} />
                    <View style={styles.userInfo}>
                        <Text variant="titleLarge">{user?.name}</Text>
                        <Text variant="bodySmall">{user?.role}</Text>
                    </View>
                    <IconButton icon="logout" onPress={handleLogout} />
                </View>

                <SegmentedButtons
                    value={activeTab}
                    onValueChange={setActiveTab}
                    buttons={[
                        { value: 'active', label: 'Jobs', icon: 'wrench' },
                        { value: 'info', label: 'Explore', icon: 'earth' },
                        { value: 'settings', label: 'More', icon: 'cog' },
                    ]}
                    style={styles.tabButtons}
                />
            </Surface>

            <View style={styles.scrollContainer}>
                {activeTab === 'active' && renderActiveTab()}
                {activeTab === 'info' && renderExploreTab()}
                {activeTab === 'settings' && renderMoreTab()}
            </View>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                action={{
                    label: 'Close',
                    onPress: () => setSnackbarVisible(false),
                }}
            >
                {snackbarMessage}
            </Snackbar>

            <Portal>
                {renderNewJobModal()}
            </Portal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    header: {
        padding: 16,
        backgroundColor: '#fff',
    },
    userProfile: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    userInfo: {
        flex: 1,
        marginLeft: 12,
    },
    tabButtons: {
        marginTop: 8,
    },
    scrollContainer: {
        flex: 1,
    },
    tabContent: {
        padding: 16,
    },
    charitySelector: {
        marginBottom: 8,
    },
    tabTitle: {
        marginBottom: 16,
        fontWeight: 'bold',
    },
    newJobButton: {
        paddingVertical: 8,
        marginBottom: 24,
        borderRadius: 8,
    },
    sectionTitle: {
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#666',
    },
    infoCard: {
        marginVertical: 12,
        backgroundColor: '#e8f5e9',
    },
    horizontalScroll: {
        marginBottom: 20,
    },
    miniCard: {
        width: 100,
        height: 100,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
    },
    emptyText: {
        textAlign: 'center',
        marginVertical: 40,
        opacity: 0.5,
    },
    divider: {
        marginVertical: 24,
    },
    modalContainer: {
        backgroundColor: 'white',
        padding: 20,
        margin: 20,
        borderRadius: 12,
        maxHeight: '80%',
    },
    modalTitle: {
        marginBottom: 20,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    formSection: {
        marginBottom: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalInput: {
        marginBottom: 16,
        backgroundColor: '#fff',
    },
    dropdownContainer: {
        marginBottom: 16,
    },
    inputLabel: {
        marginBottom: 6,
        color: '#666',
    },
    dropdownButton: {
        justifyContent: 'flex-start',
    },
    photoButton: {
        marginBottom: 24,
        borderStyle: 'dashed',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    submitButton: {
        minWidth: 120,
    },
});

export default CustomerDashboard;
