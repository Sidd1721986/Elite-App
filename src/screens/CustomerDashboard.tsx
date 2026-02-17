import * as React from 'react';
import { useState } from 'react';
import { View, ScrollView, StyleSheet, Platform, TouchableOpacity } from 'react-native';
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

    const handleLogout = async () => {
        await logout();
    };

    const handleCreateJob = async () => {
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
    };

    const handleContactAdmin = () => {
        setSnackbarMessage('Message sent to Admin. We will get back to you soon!');
        setSnackbarVisible(true);
    };

    const getStatusStep = (status: JobStatus) => {
        const steps = [
            JobStatus.SUBMITTED,
            JobStatus.SENT_TO_VENDORS,
            JobStatus.RECEIVED,
            JobStatus.QUOTED,
            JobStatus.SCHEDULED,
            JobStatus.COMPLETED_AWAITING_PAYMENT
        ];
        return (steps.indexOf(status) + 1) / steps.length;
    };

    const renderJobItem = (job: Job) => (
        <Card key={job.id} style={styles.jobCard}>
            <Card.Content>
                <View style={styles.jobHeader}>
                    <Text variant="titleMedium" style={styles.jobId}>Job #{job.id}</Text>
                    <Chip style={styles.statusChip}>{job.status}</Chip>
                </View>
                <Text variant="bodyMedium" style={styles.jobAddress}>{job.address}</Text>
                <Text variant="bodySmall" numberOfLines={2}>{job.description}</Text>

                <View style={styles.progressContainer}>
                    <Text variant="labelSmall">Status Progress</Text>
                    <ProgressBar progress={getStatusStep(job.status)} color={MD3Colors.primary50} style={styles.progressBar} />
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
                        onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
                    >
                        View Details
                    </Button>
                    {job.status === JobStatus.SUBMITTED && (
                        <Button mode="text" onPress={() => {/* Edit logic */ }}>Modify</Button>
                    )}
                </Card.Actions>
            </Card.Content>
        </Card>
    );

    const activeJobs = jobs.filter(j => j.status !== JobStatus.COMPLETED_AWAITING_PAYMENT);
    const historyJobs = jobs.filter(j => j.status === JobStatus.COMPLETED_AWAITING_PAYMENT);

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

            <ScrollView style={styles.scrollContainer}>
                {activeTab === 'active' && (
                    <View style={styles.tabContent}>
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
                        {activeJobs.length > 0 ? (
                            activeJobs.map(renderJobItem)
                        ) : (
                            <Text style={styles.emptyText}>No active jobs found.</Text>
                        )}

                        {historyJobs.length > 0 && (
                            <>
                                <Divider style={styles.divider} />
                                <Text variant="titleMedium" style={styles.sectionTitle}>Previous Job History</Text>
                                {historyJobs.map(renderJobItem)}
                            </>
                        )}
                    </View>
                )}

                {activeTab === 'info' && (
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
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                            {[1, 2, 3].map(i => (
                                <Card key={i} style={styles.miniCard}>
                                    <Avatar.Icon size={40} icon="store" />
                                    <Text variant="bodySmall">Vendor {i}</Text>
                                </Card>
                            ))}
                        </ScrollView>

                        <Text variant="titleMedium" style={styles.sectionTitle}>Featured Charities</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                            {['Red Cross', 'WWF', 'Local Pantry'].map(c => (
                                <Card key={c} style={styles.miniCard}>
                                    <Avatar.Icon size={40} icon="heart" />
                                    <Text variant="bodySmall" style={{ textAlign: 'center' }}>{c}</Text>
                                </Card>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {activeTab === 'settings' && (
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
                )}
            </ScrollView>

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
                <Modal
                    visible={isNewJobModalVisible}
                    onDismiss={() => setNewJobModalVisible(false)}
                    contentContainerStyle={styles.modalContainer}
                >
                    <ScrollView>
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
                    </ScrollView>
                </Modal>
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
