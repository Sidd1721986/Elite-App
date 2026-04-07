import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface, IconButton, Icon, List, Chip, Snackbar, Portal, Menu, Dialog } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import AppLogo from '../components/AppLogo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, User, JobStatus, Conversation } from '../types/types';
import { messageService } from '../services/messageService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobs } from '../context/JobContext'; // Assuming useJobs is imported from here

type NavigationProp = StackNavigationProp<RootStackParamList>;

const AdminDashboard: React.FC = () => {
    const { width: windowWidth } = useWindowDimensions();
    const [pendingVendors, setPendingVendors] = React.useState<User[]>([]);
    const [approvedVendors, setApprovedVendors] = React.useState<User[]>([]);
    const [refreshing, setRefreshing] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const { user, logout, deleteAccount, getPendingVendors, getApprovedVendors, updateUserStatus, removeVendor } = useAuth();
    const { jobs, refreshJobs } = useJobs();
    const navigation = useNavigation<NavigationProp>();

    const [settingsMenuVisible, setSettingsMenuVisible] = React.useState(false);
    const [deleteDialogVisible, setDeleteDialogVisible] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [conversations, setConversations] = React.useState<Conversation[]>([]);

    const fetchData = useCallback(async () => {
        setRefreshing(true);
        try {
            const [pending, approved, conv] = await Promise.all([
                getPendingVendors(),
                getApprovedVendors(),
                messageService.getConversations().catch(() => [] as Conversation[]),
            ]);
            setPendingVendors(pending);
            setApprovedVendors(approved);
            const sorted = [...(conv || [])].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            );
            setConversations(sorted);
            await refreshJobs();
        } catch (error) {
            console.error('Error fetching data:', error);
        }
        setRefreshing(false);
    }, [getPendingVendors, getApprovedVendors, refreshJobs]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Opening Chat marks messages read on the server; refetch inbox when returning so unread pills clear.
    const refreshInbox = useCallback(async () => {
        try {
            const conv = await messageService.getConversations().catch(() => [] as Conversation[]);
            const sorted = [...(conv || [])].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            );
            setConversations(sorted);
        } catch {
            /* ignore */
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void refreshInbox();
        }, [refreshInbox]),
    );

    const submittedJobs = useMemo(() => jobs.filter(j => j.status === JobStatus.SUBMITTED), [jobs]);

    // In-flight work after assignment (excludes new requests = Submitted, and closed = Completed / Invoiced / Expired)
    const activeProjects = useMemo(() => jobs.filter(j =>
        j.status === JobStatus.ASSIGNED ||
        j.status === JobStatus.ACCEPTED ||
        j.status === JobStatus.REACHED_OUT ||
        j.status === JobStatus.APPT_SET ||
        j.status === JobStatus.FOLLOW_UP ||
        j.status === JobStatus.SALE
    ), [jobs]);
    const completedJobs = useMemo(
        () => jobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.INVOICED),
        [jobs],
    );

    const scrollViewRef = React.useRef<ScrollView>(null);
    const sectionYRef = React.useRef<Record<string, number>>({});
    // sectionY state removed — scrollToSection reads sectionYRef directly

    const scrollToSection = useCallback((key: string) => {
        const y = sectionYRef.current[key];
        if (scrollViewRef.current != null && typeof y === 'number' && y >= 0) {
            scrollViewRef.current.scrollTo({ y: Math.max(0, y - 16), animated: true });
        }
    }, []);

    const updateSectionY = useCallback((key: string, y: number) => {
        sectionYRef.current = { ...sectionYRef.current, [key]: y };
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
        setSettingsMenuVisible(false);
        await logout();
    }, [logout]);

    const handleDeleteAccount = useCallback(async () => {
        setSettingsMenuVisible(false);
        setDeleteDialogVisible(false);
        setIsDeleting(true);
        try {
            const result = await deleteAccount();
            if (result !== true) {
                setSnackbarMessage(typeof result === 'string' ? result : 'Failed to delete account');
                setSnackbarVisible(true);
            }
        } catch (error) {
            setSnackbarMessage('An unexpected error occurred');
            setSnackbarVisible(true);
        } finally {
            setIsDeleting(false);
        }
    }, [deleteAccount]);

    // Stat counts must match the lists in each section + scroll targets (sectionKey).
    const messageUnreadTotal = useMemo(
        () => conversations.reduce((n, c) => n + (c.unreadCount || 0), 0),
        [conversations],
    );

    const stats = useMemo(() => [
        { label: 'Pending Vendors', value: pendingVendors.length.toString(), icon: 'account-clock', color: '#F59E0B', sectionKey: 'vendorVerification' },
        { label: 'Assign vendors', value: submittedJobs.length.toString(), icon: 'account-plus-outline', color: '#6366F1', sectionKey: 'jobRequests' },
        { label: 'Active projects', value: activeProjects.length.toString(), icon: 'progress-wrench', color: '#10B981', sectionKey: 'activeProjects' },
        { label: 'Completed', value: completedJobs.length.toString(), icon: 'check-decagram', color: '#8B5CF6', sectionKey: 'completedJobs' },
    ], [pendingVendors.length, submittedJobs.length, activeProjects.length, completedJobs.length]);

    const renderHeader = useCallback(() => (
        <View style={styles.headerWrapper}>
            <Surface style={styles.header} elevation={0}>
                <View style={styles.headerTop}>
                    <Surface style={styles.logoBox} elevation={1}>
                        <AppLogo size={36} showSurface={false} />
                    </Surface>
                    <View style={styles.adminBadge}>
                        <Chip compact style={styles.badgeChip} textStyle={styles.badgeText}>SYSTEM ADMIN</Chip>
                        <Menu
                        visible={settingsMenuVisible}
                        onDismiss={() => setSettingsMenuVisible(false)}
                        anchor={
                            <IconButton
                                icon="menu"
                                iconColor="#6366F1"
                                mode="contained"
                                containerColor="#EEF2FF"
                                size={22}
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
                        <Menu.Item 
                            leadingIcon="delete-outline" 
                            onPress={() => { setSettingsMenuVisible(false); setDeleteDialogVisible(true); }} 
                            title="Delete Account" 
                            titleStyle={{ color: '#EF4444' }} 
                        />
                    </Menu>
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
                            style={({ pressed }) => [
                                styles.statCard,
                                { width: Math.max(0, (windowWidth - 60) / 2) },
                                pressed && { opacity: 0.85 },
                            ]}
                        >
                            <Avatar.Icon size={32} icon={stat.icon} style={{ backgroundColor: stat.color + '10' }} color={stat.color} />
                            <Text variant="titleLarge" style={styles.statValue}>{stat.value}</Text>
                            <Text variant="labelSmall" style={styles.statLabel}>{stat.label}</Text>
                        </Pressable>
                    ))}
                </View>
            </Surface>
        </View>
    ), [user, handleLogout, stats, scrollToSection, settingsMenuVisible, windowWidth]);

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
                    <Button
                        mode="outlined"
                        onPress={() => navigation.navigate('Chat', { otherUserId: vendor.id || vendor.email, otherUserName: vendor.name || 'Vendor' })}
                        style={styles.messageBtn}
                        icon="message-outline"
                    >
                        Chat
                    </Button>
                </View>
            </Card.Content>
        </Card>
    ), [handleApproval, handleRemoveVendor, navigation]);

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

                <View style={styles.messagesSection}>
                    <Surface style={styles.messagesPanel} elevation={0}>
                        <View style={styles.messagesPanelHeader}>
                            <View style={styles.messagesPanelTitleBlock}>
                                <View style={styles.messagesPanelTitleRow}>
                                    <View style={styles.messagesPanelIconWrap}>
                                        <Icon source="forum-outline" size={22} color="#475569" />
                                    </View>
                                    <View style={styles.messagesPanelTitles}>
                                        <Text variant="titleMedium" style={styles.messagesPanelTitle}>
                                            Inbox
                                        </Text>
                                        <Text variant="labelSmall" style={styles.messagesPanelSubtitle}>
                                            Messages from vendors and customers
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            {messageUnreadTotal > 0 ? (
                                <View style={styles.messagesUnreadBadge}>
                                    <Text style={styles.messagesUnreadBadgeText}>{messageUnreadTotal}</Text>
                                </View>
                            ) : (
                                <Text variant="labelSmall" style={styles.messagesCountLabel}>
                                    {conversations.length} {conversations.length === 1 ? 'thread' : 'threads'}
                                </Text>
                            )}
                        </View>

                        {conversations.length > 0 ? (
                            conversations.map((c, index) => {
                                const unread = c.unreadCount || 0;
                                const timeStr = c.timestamp
                                    ? new Date(c.timestamp).toLocaleString([], {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                      })
                                    : '';
                                return (
                                    <React.Fragment key={String(c.otherUserId)}>
                                        {index > 0 ? <Divider style={styles.messageRowDivider} /> : null}
                                        <Pressable
                                            onPress={() =>
                                                navigation.navigate('Chat', {
                                                    otherUserId: String(c.otherUserId),
                                                    otherUserName: c.otherUserName || 'User',
                                                })
                                            }
                                            style={({ pressed }) => [
                                                styles.messageListRow,
                                                pressed && styles.messageListRowPressed,
                                            ]}
                                        >
                                            <Avatar.Text
                                                size={48}
                                                label={(c.otherUserName || c.otherUserEmail || '?')
                                                    .substring(0, 2)
                                                    .toUpperCase()}
                                                style={styles.messageListAvatar}
                                                labelStyle={styles.messageListAvatarLabel}
                                            />
                                            <View style={styles.messageListBody}>
                                                <View style={styles.messageListTopLine}>
                                                    <Text
                                                        variant="titleSmall"
                                                        style={[
                                                            styles.messageListName,
                                                            unread > 0 && styles.messageListNameUnread,
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {c.otherUserName || c.otherUserEmail || 'User'}
                                                    </Text>
                                                    <View style={styles.messageListTopEnd}>
                                                        {unread > 0 ? (
                                                            <View style={styles.messageUnreadPill}>
                                                                <Text style={styles.messageUnreadPillText}>
                                                                    {unread}
                                                                </Text>
                                                            </View>
                                                        ) : null}
                                                        <Text style={styles.messageListTime} numberOfLines={1}>
                                                            {timeStr}
                                                        </Text>
                                                    </View>
                                                </View>
                                                {c.otherUserEmail && c.otherUserName ? (
                                                    <Text
                                                        variant="labelSmall"
                                                        style={styles.messageListEmail}
                                                        numberOfLines={1}
                                                    >
                                                        {c.otherUserEmail}
                                                    </Text>
                                                ) : null}
                                                <Text
                                                    variant="bodySmall"
                                                    style={[
                                                        styles.messageListPreview,
                                                        unread > 0 && styles.messageListPreviewUnread,
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    {c.latestMessage || 'No preview'}
                                                </Text>
                                            </View>
                                            <IconButton
                                                icon="chevron-right"
                                                size={20}
                                                iconColor="#CBD5E1"
                                                style={styles.messageChevron}
                                            />
                                        </Pressable>
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <View style={styles.messagesEmptyInner}>
                                <IconButton icon="email-outline" size={40} iconColor="#CBD5E1" />
                                <Text variant="titleSmall" style={styles.messagesEmptyTitle}>
                                    No messages yet
                                </Text>
                                <Text variant="bodySmall" style={styles.messagesEmptyBody}>
                                    When vendors contact you from their dashboard, threads will appear here.
                                </Text>
                            </View>
                        )}
                    </Surface>
                </View>

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
                <Dialog visible={deleteDialogVisible} onDismiss={() => setDeleteDialogVisible(false)}>
                    <Dialog.Icon icon="alert-circle" color="#EF4444" />
                    <Dialog.Title style={{ textAlign: 'center' }}>Delete Account?</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={{ textAlign: 'center', color: '#64748B' }}>
                            Your profile will be deactivated. This action initiates a deletion request for your data.
                        </Text>
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setDeleteDialogVisible(false)} textColor="#64748B">Cancel</Button>
                        <Button onPress={handleDeleteAccount} loading={isDeleting} textColor="#EF4444">Delete Account</Button>
                    </Dialog.Actions>
                </Dialog>

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
    messageBtn: {
        flex: 1,
        borderRadius: 12,
        borderColor: '#6366F1',
    },
    messagesSection: {
        marginBottom: 20,
        paddingHorizontal: 24,
    },
    messagesPanel: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    messagesPanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    messagesPanelTitleBlock: {
        flex: 1,
        minWidth: 0,
    },
    messagesPanelTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    messagesPanelIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    messagesPanelTitles: {
        flex: 1,
        minWidth: 0,
    },
    messagesPanelTitle: {
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    messagesPanelSubtitle: {
        color: '#64748B',
        marginTop: 2,
        lineHeight: 16,
    },
    messagesUnreadBadge: {
        minWidth: 26,
        height: 26,
        paddingHorizontal: 8,
        borderRadius: 13,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    messagesUnreadBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    messagesCountLabel: {
        color: '#94A3B8',
        fontWeight: '600',
        marginLeft: 12,
    },
    messageListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingLeft: 16,
        paddingRight: 4,
        backgroundColor: '#FFFFFF',
    },
    messageListRowPressed: {
        backgroundColor: '#F8FAFC',
    },
    messageRowDivider: {
        marginLeft: 78,
        backgroundColor: '#F1F5F9',
    },
    messageListAvatar: {
        backgroundColor: '#EEF2FF',
    },
    messageListAvatarLabel: {
        fontWeight: '700',
        fontSize: 16,
        color: '#4F46E5',
    },
    messageListBody: {
        flex: 1,
        minWidth: 0,
        marginLeft: 14,
        paddingRight: 8,
    },
    messageListTopLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 2,
    },
    messageListName: {
        flex: 1,
        minWidth: 0,
        fontWeight: '600',
        color: '#1E293B',
        fontSize: 15,
        letterSpacing: -0.2,
        paddingRight: 8,
    },
    messageListNameUnread: {
        fontWeight: '800',
        color: '#0F172A',
    },
    messageListTopEnd: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    messageListTime: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
        minWidth: 72,
        textAlign: 'right',
    },
    messageListEmail: {
        color: '#94A3B8',
        marginBottom: 4,
    },
    messageListPreview: {
        color: '#64748B',
        lineHeight: 20,
    },
    messageListPreviewUnread: {
        color: '#334155',
        fontWeight: '500',
    },
    messageUnreadPill: {
        minWidth: 22,
        height: 22,
        paddingHorizontal: 7,
        borderRadius: 11,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    messageUnreadPillText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    messageChevron: {
        margin: 0,
        alignSelf: 'center',
    },
    messagesEmptyInner: {
        alignItems: 'center',
        paddingVertical: 36,
        paddingHorizontal: 28,
    },
    messagesEmptyTitle: {
        color: '#475569',
        fontWeight: '700',
        marginTop: 4,
    },
    messagesEmptyBody: {
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20,
        marginTop: 8,
        maxWidth: 280,
    },
});

export default React.memo(AdminDashboard);
