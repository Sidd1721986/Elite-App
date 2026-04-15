import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, Card, Button, Avatar, Divider, Surface, Chip, IconButton, List, Menu, Portal, Dialog, Snackbar, Searchbar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import AppLogo from '../components/AppLogo';
import { useJobs } from '../context/JobContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Job, JobStatus, Urgency } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useChatInboxNotifications } from '../hooks/useChatInboxNotifications';
import { JobSkeleton, DashboardStatsSkeleton } from '../components/SkeletonLoader';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const VendorList = FlashList as any;

const VendorDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { jobs, refreshJobs, isLoading } = useJobs();
    const { messageUnreadTotal, refreshInbox } = useChatInboxNotifications();
    const navigation = useNavigation<NavigationProp>();
    const [refreshing, setRefreshing] = React.useState(false);
    const [settingsMenuVisible, setSettingsMenuVisible] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const [searchQuery, setSearchQuery] = React.useState('');

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.all([refreshJobs(), refreshInbox()]);
        setRefreshing(false);
    }, [refreshJobs, refreshInbox]);

    React.useEffect(() => {
        refreshJobs();
    }, [refreshJobs]);

    const handleLogout = useCallback(async () => {
        setSettingsMenuVisible(false);
        await logout();
    }, [logout]);

    const filteredJobs = useMemo(() => {
        if (!searchQuery.trim()) return jobs;
        const query = searchQuery.toLowerCase().trim();
        return jobs.filter(j => 
            j.address?.toLowerCase().includes(query) ||
            j.description?.toLowerCase().includes(query) ||
            j.jobNumber?.toString().includes(query) ||
            `#${j.jobNumber}`.includes(query)
        );
    }, [jobs, searchQuery]);

    const activeJobs = useMemo(() =>
        filteredJobs.filter(j => 
            j.status === JobStatus.ACCEPTED || 
            j.status === JobStatus.REACHED_OUT || 
            j.status === JobStatus.APPT_SET || 
            j.status === JobStatus.SALE ||
            j.status === JobStatus.FOLLOW_UP ||
            j.status === JobStatus.COMPLETED ||
            j.status === JobStatus.INVOICE_REQUESTED
        ),
        [filteredJobs]
    );

    const pendingCount = useMemo(() => 
        jobs.filter(j => j.status === JobStatus.ASSIGNED).length, 
        [jobs]
    );

    const completedCount = useMemo(() => 
        jobs.filter(j => j.status === JobStatus.INVOICED).length,
        [jobs]
    );

    const stats = useMemo(() => [
        { label: 'Active', value: activeJobs.length.toString(), icon: 'hammer-wrench', color: '#6366F1' },
        { label: 'Pending', value: pendingCount.toString(), icon: 'clock-outline', color: '#F59E0B' },
        { label: 'Completed', value: completedCount.toString(), icon: 'check-decagram', color: '#10B981' },
    ], [activeJobs.length, pendingCount, completedCount]);

    const renderOrderCard = useCallback(({ item: job }: { item: Job }) => (
        <Card
            style={styles.orderCard}
            elevation={0}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
        >
            <Card.Content>
                <View style={styles.orderTop}>
                    <Text variant="labelSmall" style={styles.orderId}>JOB ID: #{job.jobNumber || '...'}</Text>
                    {job.urgency === Urgency.IMMEDIATE && (
                        <Chip compact style={styles.urgentChip} textStyle={styles.urgentText}>IMMEDIATE</Chip>
                    )}
                </View>
                <Text variant="titleMedium" style={styles.orderAddress} numberOfLines={1}>{job.address}</Text>
                <Text variant="bodySmall" numberOfLines={2} style={styles.orderDesc}>{job.description}</Text>

                {(job.contactPhone || job.contactEmail) && (
                    <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                        <IconButton icon="phone-outline" size={14} style={{ margin: 0 }} iconColor="#6366F1" />
                        <Text variant="labelSmall" style={{ color: '#6366F1', fontWeight: 'bold' }}>{job.contactPhone || 'N/A'}</Text>
                        <IconButton icon="email-outline" size={14} style={{ margin: 0, marginLeft: 8 }} iconColor="#94A3B8" />
                        <Text variant="labelSmall" style={{ color: '#64748B', flex: 1 }} numberOfLines={1}>{job.contactEmail || 'N/A'}</Text>
                    </View>
                )}

                <Divider style={styles.orderDivider} />

                <View style={styles.orderBottom}>
                    <View style={styles.customerRow}>
                        <Avatar.Icon 
                            size={24} 
                            icon={job.status === JobStatus.ASSIGNED ? 'clock-alert-outline' : 'account-outline'} 
                            style={[
                                styles.miniAvatar,
                                job.status === JobStatus.ASSIGNED && { backgroundColor: '#FFFBEB' },
                                job.status === JobStatus.INVOICE_REQUESTED && { backgroundColor: '#FFF7ED' }
                            ]} 
                            color={job.status === JobStatus.ASSIGNED ? '#F59E0B' : job.status === JobStatus.INVOICE_REQUESTED ? '#F97316' : '#94A3B8'}
                        />
                        <Text variant="labelSmall" style={[
                            styles.customerType, 
                            job.status === JobStatus.ASSIGNED && { color: '#F59E0B', fontWeight: 'bold' },
                            job.status === JobStatus.INVOICE_REQUESTED && { color: '#F97316', fontWeight: 'bold' }
                        ]}>
                            {job.status === JobStatus.ASSIGNED ? 'NEW ASSIGNMENT' : 
                             job.status === JobStatus.INVOICE_REQUESTED ? 'INVOICE REQUESTED' : 'ACTIVE PROJECT'}
                        </Text>
                    </View>
                    <Button
                        mode="contained"
                        compact
                        style={[
                            styles.quoteBtn, 
                            job.status === JobStatus.ASSIGNED && { backgroundColor: '#F59E0B' },
                            job.status === JobStatus.INVOICE_REQUESTED && { backgroundColor: '#F97316' }
                        ]}
                        labelStyle={{ fontSize: 10, fontWeight: 'bold' }}
                        onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
                    >
                        {job.status === JobStatus.ASSIGNED ? 'ACCEPT JOB' : 
                         job.status === JobStatus.INVOICE_REQUESTED ? 'SUBMIT INVOICE' : 'VIEW DETAILS'}
                    </Button>
                </View>
            </Card.Content>
        </Card>
    ), [navigation]);

    const renderHeader = useCallback(() => (
        <View style={styles.headerWrapper}>
            <Surface style={styles.header} elevation={0}>
                <View style={styles.headerTop}>
                    <Surface style={styles.logoBox} elevation={1}>
                        <AppLogo size={36} showSurface={false} />
                    </Surface>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                        <View style={styles.chatIconWrap}>
                            <IconButton
                                icon="message-text-outline"
                                iconColor="#6366F1"
                                mode="contained"
                                containerColor="#EEF2FF"
                                size={20}
                                onPress={() =>
                                    navigation.navigate('Chat', { otherUserId: 'admin', otherUserName: 'Admin' })
                                }
                                accessibilityLabel="Message admin"
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
                                    iconColor="#6366F1"
                                    mode="contained"
                                    containerColor="#EEF2FF"
                                    size={20}
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
                            <Menu.Item leadingIcon="logout" onPress={handleLogout} title="Logout" />
                        </Menu>
                    </View>
                </View>

                <View style={styles.profileBox}>
                    <View style={styles.profileInfo}>
                        <Text variant="headlineSmall" style={styles.vendorName}>{user?.name || 'QuickFix Pro'}</Text>
                        <View style={styles.ratingBox}>
                            <IconButton icon="star" iconColor="#F59E0B" size={16} style={{ margin: 0 }} />
                            <Text variant="labelLarge" style={styles.ratingText}>4.9 (128 reviews)</Text>
                        </View>
                    </View>
                    <Avatar.Text
                        size={64}
                        label={user?.name?.substring(0, 2).toUpperCase() || 'VX'}
                        style={styles.mainAvatar}
                    />
                </View>

                <Searchbar
                    placeholder="Search by Job # or Address"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    inputStyle={styles.searchInput}
                    iconColor="#6366F1"
                    placeholderTextColor="#94A3B8"
                    elevation={0}
                />

                {isLoading ? (
                    <DashboardStatsSkeleton />
                ) : (
                    <View style={styles.statsRow}>
                        {stats.map((s, i) => (
                            <View key={i} style={styles.statItem}>
                                <IconButton icon={s.icon} iconColor={s.color} size={20} style={{ margin: 0 }} />
                                <View>
                                    <Text variant="titleMedium" style={styles.statValue}>{s.value}</Text>
                                    <Text variant="labelSmall" style={styles.statLabel}>{s.label}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </Surface>
        </View>
    ), [user, handleLogout, stats, settingsMenuVisible, navigation, messageUnreadTotal]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={{ flex: 1 }}>
                <VendorList
                    data={isLoading ? [] : activeJobs}
                    keyExtractor={(item: Job) => item.id}
                    renderItem={renderOrderCard}
                    estimatedItemSize={250}
                    ListHeaderComponent={() => (
                        <View>
                            {renderHeader()}
                            {isLoading && (
                                <View style={{ marginTop: 8 }}>
                                    <JobSkeleton />
                                    <JobSkeleton />
                                </View>
                            )}
                        </View>
                    )}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponentStyle={styles.headerList}
                ListEmptyComponent={() => (
                    <View style={styles.emptyBox}>
                        <IconButton icon="briefcase-variant-off-outline" size={48} iconColor="#E2E8F0" />
                        <Text variant="bodyLarge" style={styles.emptyText}>No available jobs in your area.</Text>
                        <Button mode="text" onPress={onRefresh}>Refresh Feed</Button>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
                />
            </View>

            <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000}>
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
    headerWrapper: {
        marginBottom: 20,
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        paddingBottom: 40,
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
    chatIconWrap: {
        position: 'relative',
    },
    chatBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
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
    headerLogo: {
        width: 28,
        height: 28,
    },
    profileBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    profileInfo: {
        flex: 1,
    },
    vendorName: {
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    ratingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingText: {
        color: '#64748B',
    },
    mainAvatar: {
        backgroundColor: '#6366F1',
    },
    searchBar: {
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        marginBottom: 24,
        height: 48,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        fontSize: 14,
        minHeight: 0,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statValue: {
        fontWeight: 'bold',
        color: '#1E293B',
        lineHeight: 20,
    },
    statLabel: {
        color: '#94A3B8',
        textTransform: 'uppercase',
        fontSize: 9,
        letterSpacing: 0.5,
    },
    headerList: {
        marginBottom: 24,
    },
    listContent: {
        paddingBottom: 40,
    },
    orderCard: {
        marginHorizontal: 24,
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    orderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderId: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    urgentChip: {
        backgroundColor: '#FEF2F2',
        borderRadius: 8,
    },
    urgentText: {
        color: '#EF4444',
        fontSize: 10,
        fontWeight: '900',
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    orderAddress: {
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 4,
    },
    orderDesc: {
        color: '#64748B',
        lineHeight: 18,
    },
    orderDivider: {
        marginVertical: 16,
        backgroundColor: '#F1F5F9',
    },
    orderBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    miniAvatar: {
        backgroundColor: '#F1F5F9',
    },
    customerType: {
        color: '#94A3B8',
    },
    quoteBtn: {
        borderRadius: 8,
        backgroundColor: '#1E293B',
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
});

export default React.memo(VendorDashboard);
