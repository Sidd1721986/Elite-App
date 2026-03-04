import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView, Dimensions, Platform, Pressable } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface, IconButton, List, Chip, Snackbar, Portal } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import AppLogo from '../components/AppLogo';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, User, JobStatus } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobs } from '../context/JobContext'; // Assuming useJobs is imported from here

type NavigationProp = StackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

const AdminDashboard: React.FC = () => {
    const [pendingVendors, setPendingVendors] = React.useState<User[]>([]);
    const [approvedVendors, setApprovedVendors] = React.useState<User[]>([]);
    const [refreshing, setRefreshing] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const { user, logout, getPendingVendors, getApprovedVendors, updateUserStatus, removeVendor } = useAuth();
    const { jobs, refreshJobs } = useJobs();
    const navigation = useNavigation<NavigationProp>();

    const fetchData = useCallback(async () => {
        setRefreshing(true);
        try {
            const [pending, approved] = await Promise.all([
                getPendingVendors(),
                getApprovedVendors()
            ]);
            setPendingVendors(pending);
            setApprovedVendors(approved);
            await refreshJobs();
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        setRefreshing(false);
    }, [getPendingVendors, getApprovedVendors, refreshJobs]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const activeJobsCount = useMemo(() => jobs.filter(j => j.status !== JobStatus.COMPLETED).length, [jobs]);
    const submittedJobs = useMemo(() => jobs.filter(j => j.status === JobStatus.SUBMITTED), [jobs]);
    const completedJobsCount = useMemo(
        () => jobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.INVOICED).length,
        [jobs],
    );
    const pendingJobCount = useMemo(
        () => jobs.filter(j => j.status === JobStatus.SUBMITTED).length,
        [jobs],
    );
    const salesCount = useMemo(
        () => jobs.filter(j => j.status === JobStatus.SALE).length,
        [jobs],
    );
    const jobsInProgressCount = useMemo(() => jobs.filter(j =>
        j.status === JobStatus.ACCEPTED ||
        j.status === JobStatus.REACHED_OUT ||
        j.status === JobStatus.APPT_SET ||
        j.status === JobStatus.FOLLOW_UP
    ).length, [jobs]);

    const activeProjects = useMemo(() => jobs.filter(j =>
        j.status === JobStatus.ASSIGNED ||
        j.status === JobStatus.ACCEPTED ||
        j.status === JobStatus.SALE
    ), [jobs]);
    const completedJobs = useMemo(
        () => jobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.INVOICED),
        [jobs],
    );

    const scrollViewRef = React.useRef<ScrollView>(null);
    const sectionYRef = React.useRef<Record<string, number>>({});
    const [sectionY, setSectionY] = React.useState<Record<string, number>>({});

    const scrollToSection = useCallback((key: string) => {
        const y = sectionYRef.current[key];
        if (scrollViewRef.current != null && typeof y === 'number' && y >= 0) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, y - 16), animated: true });
        }
    }, []);

    const updateSectionY = useCallback((key: string, y: number) => {
        sectionYRef.current = { ...sectionYRef.current, [key]: y };
        setSectionY(prev => ({ ...prev, [key]: y }));
    }, []);

    const getTimelineBarColor = useCallback((createdAt: string): string => {
        if (!createdAt) return '#22C55E';
        const created = new Date(createdAt).getTime();
        if (Number.isNaN(created)) return '#22C55E';
        const now = Date.now();
        const hoursElapsed = Math.max(0, (now - created) / (1000 * 60 * 60));
        if (hoursElapsed <= 12) return '#22C55E';   // green
        if (hoursElapsed <= 24) return '#84CC16';   // lime
        if (hoursElapsed <= 36) return '#EAB308';   // yellow
        if (hoursElapsed <= 48) return '#F97316';   // orange
        if (hoursElapsed <= 60) return '#EF4444';   // red
        return '#B91C1C';                            // super red (past 48h)
    }, []);

    const handleApproval = async (userId: string, approved: boolean) => {
        setRefreshing(true);
        try {
            const success = await updateUserStatus(userId, approved);
            if (success) {
                setSnackbarMessage(approved ? 'Vendor approved successfully!' : 'Vendor request denied.');
                setSnackbarVisible(true);
                await fetchData();
            } else {
                setSnackbarMessage('Failed to update vendor status.');
                setSnackbarVisible(true);
            }
        } catch (error) {
            setSnackbarMessage('An unexpected error occurred.');
            setSnackbarVisible(true);
        }
        setRefreshing(false);
    };

    const handleRemoveVendor = async (userId: string) => {
        setRefreshing(true);
        try {
            const success = await removeVendor(userId);
            if (success) {
                setSnackbarMessage('Vendor removed successfully.');
                setSnackbarVisible(true);
                await fetchData();
            } else {
                setSnackbarMessage('Failed to remove vendor.');
                setSnackbarVisible(true);
            }
        } catch (error) {
            setSnackbarMessage('An unexpected error occurred.');
            setSnackbarVisible(true);
        }
        setRefreshing(false);
    };

    const handleLogout = useCallback(async () => {
        await logout();
    }, [logout]);

    const stats = useMemo(() => [
        { label: 'Pending Vendors', value: pendingVendors.length.toString(), icon: 'account-clock', color: '#F59E0B', sectionKey: 'vendorVerification' },
        { label: 'Assign vendors', value: submittedJobs.length.toString(), icon: 'account-plus-outline', color: '#6366F1', sectionKey: 'jobRequests' },
        { label: 'Job in progress', value: jobsInProgressCount.toString(), icon: 'progress-wrench', color: '#10B981', sectionKey: 'activeProjects' },
        { label: 'Number of Sale', value: salesCount.toString(), icon: 'cash-multiple', color: '#8B5CF6', sectionKey: 'completedJobs' },
    ], [pendingVendors.length, submittedJobs.length, jobsInProgressCount, salesCount]);

    const renderHeader = useCallback(() => (
        <View style={styles.headerWrapper}>
            <Surface style={styles.header} elevation={0}>
                <View style={styles.headerTop}>
                    <Surface style={styles.logoBox} elevation={1}>
                        <AppLogo size={36} showSurface={false} />
                    </Surface>
                    <View style={styles.adminBadge}>
                        <Chip compact style={styles.badgeChip} textStyle={styles.badgeText}>SYSTEM ADMIN</Chip>
                        <IconButton
                            icon="power"
                            iconColor="#EF4444"
                            mode="contained"
                            containerColor="#FEF2F2"
                            size={20}
                            onPress={handleLogout}
                        />
                    </View>
                </View>

                <View style={styles.profileBox}>
                    <Avatar.Icon size={64} icon="shield-crown-outline" style={styles.mainAvatar} color="#FFFFFF" />
                    <View style={styles.profileText}>
                        <Text variant="headlineSmall" style={styles.welcomeText}>Control Center</Text>
                        <Text variant="bodyMedium" style={styles.emailText}>{user?.email}</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    {stats.map((stat, index) => (
                        <Pressable
                            key={index}
                            onPress={() => scrollToSection((stat as any).sectionKey)}
                            style={({ pressed }) => [styles.statCard, pressed && { opacity: 0.85 }]}
                        >
                            <Avatar.Icon size={32} icon={stat.icon} style={{ backgroundColor: stat.color + '10' }} color={stat.color} />
                            <Text variant="titleLarge" style={styles.statValue}>{stat.value}</Text>
                            <Text variant="labelSmall" style={styles.statLabel}>{stat.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </Surface>
        </View>
    ), [user, handleLogout, stats, scrollToSection]);

    const renderVendorItem = useCallback(({ item: vendor }: { item: User }) => (
        <Card style={styles.approvalCard} elevation={0}>
            <Card.Content style={styles.cardInner}>
                <View style={styles.cardHeader}>
                    <Avatar.Text size={40} label={(vendor.email || '??').substring(0, 2).toUpperCase()} style={styles.vendorAvatar} />
                    <View style={styles.vendorInfo}>
                        <Text variant="titleMedium" style={styles.vendorName}>{vendor.name || 'Anonymous Vendor'}</Text>
                        <Text variant="labelSmall" style={styles.vendorEmail}>{vendor.email}</Text>
                    </View>
                    <Chip style={styles.pendingChip}>PENDING</Chip>
                </View>

                <Divider style={styles.cardDivider} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <IconButton icon="map-marker-outline" size={16} style={{ margin: 0 }} />
                        <Text variant="labelSmall">{vendor.address || 'No Address'}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <IconButton icon="phone-outline" size={16} style={{ margin: 0 }} />
                        <Text variant="labelSmall">{vendor.phone || 'No Phone'}</Text>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <Button
                        mode="contained"
                        onPress={() => handleApproval(vendor.id || '', true)}
                        style={styles.approveBtn}
                    >
                        Approve
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={() => handleApproval(vendor.id || '', false)}
                        style={styles.denyBtn}
                        textColor="#EF4444"
                    >
                        Deny
                    </Button>
                </View>
            </Card.Content>
        </Card>
    ), []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView
                ref={scrollViewRef}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
                }
                contentContainerStyle={styles.scrollContent}
            >
                {renderHeader()}

                <View
                    onLayout={(e) => updateSectionY('jobRequests', e.nativeEvent.layout.y)}
                >
                    <View style={styles.sectionHeaderBar}>
                        <Text variant="titleLarge" style={styles.sectionTitle}>Job Requests</Text>
                        <Chip style={styles.sectionChip}>{submittedJobs.length} New</Chip>
                    </View>

                    {submittedJobs.length > 0 ? (
                        submittedJobs.map(job => (
                            <Card key={job.id} style={styles.approvalCard} elevation={0} onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}>
                                <Card.Content style={styles.cardInner}>
                                    <View style={styles.requestCardRow}>
                                        <View style={[styles.timelineBar, { backgroundColor: getTimelineBarColor(job.createdAt) }]} />
                                        <View style={styles.requestCardContent}>
                                            <View style={styles.vendorInfo}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text variant="titleMedium" style={styles.vendorName} numberOfLines={1}>{job.address}</Text>
                                                </View>
                                                <Text variant="labelSmall" style={{ color: '#64748B', fontWeight: 'bold' }} numberOfLines={1}>{job.customer?.name || 'Homeowner'}</Text>
                                                <Text variant="labelSmall" style={styles.vendorEmail} numberOfLines={1}>{job.description}</Text>
                                                {(job.contactPhone || job.contactEmail) && (
                                                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                                        {job.contactPhone && <Text variant="labelSmall" style={{ color: '#6366F1', fontWeight: 'bold' }}>{job.contactPhone} </Text>}
                                                        {job.contactEmail && <Text variant="labelSmall" style={{ color: '#94A3B8' }}>• {job.contactEmail}</Text>}
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.actionColumn}>
                                                <Button
                                                    mode="contained"
                                                    compact
                                                    onPress={() => navigation.navigate('AssignVendor', { jobId: job.id })}
                                                    style={styles.jobActionBtn}
                                                    icon="account-plus-outline"
                                                    labelStyle={{ fontSize: 11 }}
                                                >
                                                    Assign
                                                </Button>
                                            </View>
                                        </View>
                                    </View>
                                </Card.Content>
                            </Card>
                        ))
                    ) : (
                        <View style={styles.emptyBox}>
                            <IconButton icon="briefcase-check-outline" size={48} iconColor="#E2E8F0" />
                            <Text variant="bodyLarge" style={styles.emptyText}>No new job requests.</Text>
                        </View>
                    )}
                </View>

                <View
                    onLayout={(e) => updateSectionY('vendorVerification', e.nativeEvent.layout.y)}
                >
                    <View style={styles.sectionHeader}>
                        <Text variant="titleLarge" style={styles.sectionTitle}>Vendor Verification</Text>
                        <Chip style={{ backgroundColor: '#F1F5F9' }}>{pendingVendors.length} New</Chip>
                    </View>

                    {pendingVendors.length > 0 ? (
                        pendingVendors.map(vendor => (
                            <View key={vendor.id}>{renderVendorItem({ item: vendor })}</View>
                        ))
                    ) : (
                        <View style={styles.emptyBox}>
                            <IconButton icon="account-check-outline" size={48} iconColor="#E2E8F0" />
                            <Text variant="bodyLarge" style={styles.emptyText}>All vendors are verified.</Text>
                        </View>
                    )}
                </View>

                <View
                    onLayout={(e) => updateSectionY('activeProjects', e.nativeEvent.layout.y)}
                >
                    <View style={styles.sectionHeader}>
                        <Text variant="titleLarge" style={styles.sectionTitle}>Active Projects</Text>
                        <Chip style={{ backgroundColor: '#ECFDF5' }}>{activeProjects.length} Total</Chip>
                    </View>

                    {activeProjects.length > 0 ? (
                        activeProjects.map(job => (
                            <Card key={job.id} style={styles.approvalCard} elevation={0} onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}>
                                <Card.Content style={styles.cardInner}>
                                    <View style={styles.cardHeader}>
                                        <Avatar.Icon size={40} icon="hammer-wrench" style={{ backgroundColor: '#ECFDF5' }} color="#10B981" />
                                        <View style={styles.vendorInfo}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text variant="titleMedium" style={styles.vendorName}>{job.address}</Text>
                                            </View>
                                            <Text variant="labelSmall" style={{ color: '#94A3B8' }}>{job.customer?.name || 'Homeowner'} • {(job.status || 'SUBMITTED').toUpperCase()}</Text>
                                            {(job.contactPhone || job.contactEmail) && (
                                                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                                                    {job.contactPhone && <Text variant="labelSmall" style={{ color: '#10B981', fontWeight: 'bold' }}>{job.contactPhone} </Text>}
                                                    {job.contactEmail && <Text variant="labelSmall" style={{ color: '#94A3B8' }}>• {job.contactEmail}</Text>}
                                                </View>
                                            )}
                                        </View>
                                        <IconButton icon="chevron-right" />
                                    </View>
                                </Card.Content>
                            </Card>
                        ))
                    ) : (
                        <View style={styles.emptyBox}>
                            <IconButton icon="progress-wrench" size={48} iconColor="#E2E8F0" />
                            <Text variant="bodyLarge" style={styles.emptyText}>No active projects found.</Text>
                        </View>
                    )}
                </View>

                <View
                    onLayout={(e) => updateSectionY('verifiedVendors', e.nativeEvent.layout.y)}
                >
                    <View style={styles.sectionHeader}>
                        <Text variant="titleLarge" style={styles.sectionTitle}>Verified Vendors</Text>
                        <Chip style={{ backgroundColor: '#EEF2FF' }}>{approvedVendors.length} Total</Chip>
                    </View>

                    {approvedVendors.length > 0 ? (
                        approvedVendors.map(vendor => (
                            <Card key={vendor.id} style={styles.approvalCard} elevation={0}>
                                <Card.Content style={styles.cardInner}>
                                    <View style={styles.cardHeader}>
                                        <Avatar.Text size={40} label={(vendor.email || '??').substring(0, 2).toUpperCase()} style={{ backgroundColor: '#F0FDF4' }} color="#15803D" />
                                        <View style={styles.vendorInfo}>
                                            <Text variant="titleMedium" style={styles.vendorName}>{vendor.name || 'Anonymous Vendor'}</Text>
                                            <Text variant="labelSmall" style={styles.vendorEmail}>{vendor.email}</Text>
                                        </View>
                                        <Chip icon="check-decagram" style={{ backgroundColor: '#F0FDF4' }} textStyle={{ color: '#15803D' }}>VERIFIED</Chip>
                                    </View>
                                    <View style={styles.cardActions}>
                                        <Button
                                            mode="outlined"
                                            onPress={() => handleRemoveVendor(vendor.id || '')}
                                            style={styles.denyBtn}
                                            textColor="#EF4444"
                                            icon="trash-can-outline"
                                        >
                                            Remove Vendor
                                        </Button>
                                    </View>
                                </Card.Content>
                            </Card>
                        ))
                    ) : (
                        <View style={styles.emptyBox}>
                            <Text variant="bodyLarge" style={styles.emptyText}>No verified vendors yet.</Text>
                        </View>
                    )}
                </View>

                <View
                    onLayout={(e) => updateSectionY('completedJobs', e.nativeEvent.layout.y)}
                >
                    <View style={styles.sectionHeader}>
                        <Text variant="titleLarge" style={styles.sectionTitle}>Completed Jobs</Text>
                        <Chip style={{ backgroundColor: '#F0FDF4' }}>{completedJobs.length} Total</Chip>
                    </View>

                    {completedJobs.length > 0 ? (
                        completedJobs.map(job => (
                            <Card key={job.id} style={styles.approvalCard} elevation={0} onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}>
                                <Card.Content style={styles.cardInner}>
                                    <View style={styles.cardHeader}>
                                        <Avatar.Icon size={40} icon="check-decagram" style={{ backgroundColor: '#ECFDF5' }} color="#059669" />
                                        <View style={styles.vendorInfo}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Text variant="titleMedium" style={styles.vendorName}>{job.address}</Text>
                                            </View>
                                            <Text variant="labelSmall" style={{ color: '#94A3B8' }}>{job.customer?.name || 'Homeowner'} • {(job.status || '').toUpperCase()}</Text>
                                        </View>
                                        <IconButton icon="chevron-right" />
                                    </View>
                                </Card.Content>
                            </Card>
                        ))
                    ) : (
                        <View style={styles.emptyBox}>
                            <IconButton icon="check-circle-outline" size={48} iconColor="#E2E8F0" />
                            <Text variant="bodyLarge" style={styles.emptyText}>No completed jobs yet.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <Portal>
                <Snackbar
                    visible={snackbarVisible}
                    onDismiss={() => setSnackbarVisible(false)}
                    duration={3000}
                    action={{
                        label: 'OK',
                        onPress: () => setSnackbarVisible(false),
                    }}
                    style={styles.snackbar}
                >
                    {snackbarMessage}
                </Snackbar>
            </Portal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerWrapper: {
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 4,
    },
    header: {
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
    logoBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerLogo: {
        width: 28,
        height: 28,
    },
    adminBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badgeChip: {
        backgroundColor: '#1E293B',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    profileBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
        gap: 16,
    },
    mainAvatar: {
        backgroundColor: '#1E293B',
    },
    profileText: {
        flex: 1,
    },
    welcomeText: {
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    emailText: {
        color: '#64748B',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        justifyContent: 'space-between',
    },
    statCard: {
        width: (width - 60) / 2,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: {
        fontWeight: '900',
        color: '#1E293B',
        marginTop: 8,
    },
    statLabel: {
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 12,
        marginBottom: 16,
    },
    sectionHeaderBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 14,
        marginHorizontal: 0,
        marginTop: 8,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    sectionChip: {
        backgroundColor: '#EEF2FF',
    },
    sectionTitle: {
        fontWeight: '900',
        color: '#1E293B',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    approvalCard: {
        marginHorizontal: 24,
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardInner: {
        padding: 0,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    vendorAvatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorInfo: {
        flex: 1,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    vendorEmail: {
        color: '#94A3B8',
    },
    pendingChip: {
        backgroundColor: '#FFFBEB',
        height: 24,
    },
    cardDivider: {
        backgroundColor: '#F1F5F9',
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 16,
        marginVertical: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    approveBtn: {
        flex: 1,
        borderRadius: 12,
        backgroundColor: '#10B981',
    },
    denyBtn: {
        flex: 1,
        borderRadius: 12,
        borderColor: '#EF4444',
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#94A3B8',
        marginTop: 16,
    },
    snackbar: {
        marginBottom: 20,
        backgroundColor: '#1E293B',
        borderRadius: 12,
    },
    requestCardRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 100,
    },
    timelineBar: {
        width: 6,
        borderRadius: 3,
        borderTopLeftRadius: 24,
        borderBottomLeftRadius: 24,
    },
    requestCardContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    actionColumn: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 100,
    },
    jobActionBtn: {
        borderRadius: 10,
        backgroundColor: '#6366F1',
        elevation: 0,
        width: '100%',
    },
});

export default React.memo(AdminDashboard);
