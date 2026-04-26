import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, Card, Button, Avatar, Divider, Surface, IconButton, Icon, List, Chip, Snackbar, Portal, Menu, Dialog, Searchbar } from 'react-native-paper';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import AppLogo from '../components/AppLogo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, User, Job, JobStatus, Conversation } from '../types/types';
import { messageService } from '../services/messageService';
import { formatChatPreview } from '../utils/chatMessageContent';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobs } from '../context/JobContext'; // Assuming useJobs is imported from here

type NavigationProp = StackNavigationProp<RootStackParamList>;

type AdminDashboardDataItem =
    | { type: 'section_inbox' }
    | { type: 'section_header', title: string, count: number, sectionKey: string, chipColor: string, chipText: string }
    | { type: 'job_request', data: Job }
    | { type: 'vendor_verification', data: User }
    | { type: 'active_project', data: Job }
    | { type: 'verified_vendor', data: User }
    | { type: 'completed_job', data: Job }
    | { type: 'empty', title: string, icon: string }
    | { type: 'show_more_requests', hidden: number }
    | { type: 'show_more_inprogress', hidden: number };

const AdminList = FlashList as any;

// ─── Vendor progress pipeline ─────────────────────────────────────────────────
/** Ordered steps a vendor takes from assignment to job completion. */
const VENDOR_PIPELINE = [
    { status: JobStatus.ASSIGNED,     label: 'Assigned',    short: 'Asgn',  icon: 'account-check-outline',      color: '#6366F1' },
    { status: JobStatus.ACCEPTED,     label: 'Accepted',    short: 'Accpt', icon: 'handshake-outline',           color: '#10B981' },
    { status: JobStatus.REACHED_OUT,  label: 'Reached Out', short: 'Call',  icon: 'phone-forward-outline',       color: '#F59E0B' },
    { status: JobStatus.APPT_SET,     label: 'Appt Set',    short: 'Appt',  icon: 'calendar-check-outline',      color: '#8B5CF6' },
    { status: JobStatus.SALE,         label: 'Sale',        short: 'Sale',  icon: 'cash-check',                  color: '#059669' },
    { status: JobStatus.FOLLOW_UP,    label: 'Follow Up',   short: 'FU',    icon: 'message-reply-text-outline',  color: '#F97316' },
] as const;

function getPipelineIndex(status: string): number {
    return VENDOR_PIPELINE.findIndex(s => s.status === status);
}

/** Horizontal dot-and-line progress bar showing the vendor's current step. */
const StatusPipeline = React.memo(({ currentStatus }: { currentStatus: string }) => {
    const currentIdx = getPipelineIndex(currentStatus);
    const step = currentIdx >= 0 ? VENDOR_PIPELINE[currentIdx] : null;
    return (
        <View>
            <View style={pipelineStyles.track}>
                {VENDOR_PIPELINE.map((s, idx) => {
                    const done    = idx < currentIdx;
                    const current = idx === currentIdx;
                    const dotBg   = done ? '#10B981' : current ? s.color : '#E2E8F0';
                    return (
                        <React.Fragment key={s.status}>
                            {idx > 0 && (
                                <View style={[
                                    pipelineStyles.line,
                                    { backgroundColor: idx <= currentIdx ? (done ? '#10B981' : s.color) : '#E2E8F0' },
                                ]} />
                            )}
                            <View style={[
                                pipelineStyles.dot,
                                { backgroundColor: dotBg, width: current ? 12 : 8, height: current ? 12 : 8, borderRadius: 6 },
                                current && { shadowColor: s.color, shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 },
                            ]} />
                        </React.Fragment>
                    );
                })}
            </View>
            {step && (
                <Text style={[pipelineStyles.label, { color: step.color }]}>
                    {step.label.toUpperCase()}
                </Text>
            )}
        </View>
    );
});

const pipelineStyles = StyleSheet.create({
    track:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 2 },
    line:   { flex: 1, height: 2, marginHorizontal: 2 },
    dot:    { borderRadius: 6 },
    label:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
});
// ─────────────────────────────────────────────────────────────────────────────

const AdminDashboard: React.FC = () => {
    const { width: windowWidth } = useWindowDimensions();
    const reducedMotion = useReducedMotion();
    const [pendingVendors, setPendingVendors] = React.useState<User[]>([]);
    const [approvedVendors, setApprovedVendors] = React.useState<User[]>([]);
    const [refreshing, setRefreshing] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const { user, logout, getPendingVendors, getApprovedVendors, updateUserStatus, removeVendor } = useAuth();
    const { jobs, refreshJobs } = useJobs();
    const navigation = useNavigation<NavigationProp>();

    const [settingsMenuVisible, setSettingsMenuVisible] = React.useState(false);
    const [conversations, setConversations] = React.useState<Conversation[]>([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [vendorSearch, setVendorSearch] = React.useState('');
    const [inProgressSearch, setInProgressSearch] = React.useState('');
    const [showAllRequests, setShowAllRequests] = React.useState(false);
    const [showAllInProgress, setShowAllInProgress] = React.useState(false);
    const SECTION_PREVIEW = 3;

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
                (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
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
                (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
            );
            setConversations(sorted);
        } catch {
            /* ignore */
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            // Always fetch fresh job statuses when admin returns to this screen
            // so vendor progress (Accepted → Reached Out → Appt Set …) is visible
            // without requiring a manual pull-to-refresh.
            void refreshInbox();
            void refreshJobs();
        }, [refreshInbox, refreshJobs]),
    );

    const jobsDeduped = useMemo(() => {
        const seen = new Set<string>();
        return jobs.filter(j => {
            if (!j?.id) {return false;}
            if (seen.has(j.id)) {return false;}
            seen.add(j.id);
            return true;
        });
    }, [jobs]);

    const filteredJobs = useMemo(() => {
        // Hide only true shell records (typically split-parent containers) but keep real submitted requests visible.
        const visibleJobs = jobsDeduped.filter(j => {
            // Split children are represented on the parent card; do not show duplicate rows.
            if (j.parentJobId) {return false;}

            const hasServices = Array.isArray(j.services) && j.services.length > 0;
            const hasItems = Array.isArray(j.items) && j.items.length > 0;
            const hasVendor = !!j.vendorId;
            const hasCustomerContent =
                Boolean(j.description?.trim()) ||
                Boolean(j.address?.trim()) ||
                Boolean(j.contactPhone?.trim()) ||
                Boolean(j.contactEmail?.trim());
            const hasChildren = Array.isArray(j.childJobs) && j.childJobs.length > 0;

            // Keep any real request/activity row; hide only empty parent containers.
            if (hasServices || hasItems || hasVendor || hasCustomerContent) {return true;}
            return !hasChildren;
        });

        if (!searchQuery.trim()) {return visibleJobs;}
        const query = searchQuery.toLowerCase().trim();
        return visibleJobs.filter(j =>
            j.address?.toLowerCase().includes(query) ||
            j.description?.toLowerCase().includes(query) ||
            j.jobNumber?.toString().includes(query) ||
            `#${j.jobNumber}`.includes(query) ||
            j.customer?.name?.toLowerCase().includes(query)
        );
    }, [jobsDeduped, searchQuery]);

    /** Vendor list filtered by the inline search bar in the Verified Vendors section. */
    const filteredApprovedVendors = useMemo(() => {
        if (!vendorSearch.trim()) {return approvedVendors;}
        const q = vendorSearch.toLowerCase().trim();
        return approvedVendors.filter(v =>
            v.name?.toLowerCase().includes(q) ||
            v.email?.toLowerCase().includes(q) ||
            v.phone?.includes(q)
        );
    }, [approvedVendors, vendorSearch]);

    /** In Progress list filtered by the inline search bar in that section. */
    /**
     * "Job Requests" section — jobs the admin still needs to action.
     * Includes:
     *  - Submitted: brand-new customer request, not yet touched by admin.
     *  - PartiallyAssigned: admin is mid-way through splitting/reassigning the job
     *    (vendors cannot see it yet — they only see it after "Mark Fully Assigned").
     */
    const submittedJobs = useMemo(() => filteredJobs.filter(j =>
        j.status === JobStatus.SUBMITTED ||
        j.status === JobStatus.PARTIALLY_ASSIGNED
    ), [filteredJobs]);

    const ACTIVE_STATUSES = useMemo(() => new Set<string>([
        JobStatus.ASSIGNED, JobStatus.ACCEPTED, JobStatus.REACHED_OUT,
        JobStatus.APPT_SET, JobStatus.SALE, JobStatus.FOLLOW_UP,
    ]), []);

    const DONE_STATUSES = useMemo(() => new Set<string>([
        JobStatus.COMPLETED, JobStatus.INVOICE_REQUESTED, JobStatus.INVOICED,
    ]), []);

    /**
     * Collects active child jobs for a given parent, looking in TWO places:
     *  1. The flat `jobsDeduped` list — populated after JobContext flattens the API response.
     *  2. The parent's own `childJobs` array — present immediately after the API returns
     *     nested data, before the flat list catches up.
     *
     * This dual-source approach means the pipeline is always up-to-date regardless
     * of whether the backend sends children flat or nested.
     */
    const collectActiveChildren = useCallback(
        (parentJob: Job, statusSet: Set<string>): Job[] => {
            const seen = new Set<string>();
            const result: Job[] = [];

            const add = (child: any) => {
                if (!child?.id || seen.has(String(child.id))) {return;}
                if (!statusSet.has(child.status)) {return;}
                seen.add(String(child.id));
                result.push({
                    ...child,
                    // Inherit address + customer from parent so the card shows
                    // the original customer request context, not the sub-job stub.
                    address:  child.address  || parentJob.address,
                    customer: child.customer || parentJob.customer,
                    contacts: child.contacts?.length ? child.contacts : parentJob.contacts,
                });
            };

            // Source 1 — flat list
            jobsDeduped
                .filter(j => j.parentJobId && String(j.parentJobId) === String(parentJob.id))
                .forEach(add);

            // Source 2 — nested in parent (backend embeds childJobs)
            (parentJob.childJobs || []).forEach(add);

            return result;
        },
        [jobsDeduped],
    );

    /**
     * "In Progress" — live vendor work, one card per vendor scope.
     * For split jobs we show each child with its own live status pipeline
     * instead of the frozen parent, which stays "Assigned" forever.
     */
    const activeProjects = useMemo(() => {
        const result: Job[] = [];
        const suppressedParentIds = new Set<string>();

        filteredJobs.forEach(parentJob => {
            const activeChildren = collectActiveChildren(parentJob, ACTIVE_STATUSES);
            if (activeChildren.length > 0) {
                suppressedParentIds.add(String(parentJob.id));
                result.push(...activeChildren);
            }
        });

        // Parent/direct jobs in active states not covered by children
        filteredJobs
            .filter(j => ACTIVE_STATUSES.has(j.status) && !suppressedParentIds.has(String(j.id)))
            .forEach(j => result.push(j));

        return result.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
    }, [filteredJobs, collectActiveChildren, ACTIVE_STATUSES]);

    /** In Progress list filtered by the inline search bar. Must come AFTER activeProjects. */
    const filteredActiveProjects = useMemo(() => {
        if (!inProgressSearch.trim()) {return activeProjects;}
        const q = inProgressSearch.toLowerCase().trim();
        return activeProjects.filter(j =>
            j.address?.toLowerCase().includes(q) ||
            j.customer?.name?.toLowerCase().includes(q) ||
            j.vendor?.name?.toLowerCase().includes(q) ||
            j.jobNumber?.toString().includes(q) ||
            (j.services || []).some(s => s.toLowerCase().includes(q))
        );
    }, [activeProjects, inProgressSearch]);

    /**
     * "Completed" — only after vendor taps Mark Complete.
     * Same dual-source child lookup so split completions surface correctly.
     */
    const completedJobs = useMemo(() => {
        const result: Job[] = [];
        const suppressedParentIds = new Set<string>();

        filteredJobs.forEach(parentJob => {
            const doneChildren = collectActiveChildren(parentJob, DONE_STATUSES);
            if (doneChildren.length > 0) {
                suppressedParentIds.add(String(parentJob.id));
                result.push(...doneChildren);
            }
        });

        filteredJobs
            .filter(j => DONE_STATUSES.has(j.status) && !suppressedParentIds.has(String(j.id)))
            .forEach(j => result.push(j));

        return result.sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
    }, [filteredJobs, collectActiveChildren, DONE_STATUSES]);

    const scrollViewRef = React.useRef<any>(null);
    // Keeps a live reference to listData so scrollToSection can find
    // the index of any section header without causing circular deps.
    const listDataRef = React.useRef<AdminDashboardDataItem[]>([]);

    const scrollToSection = useCallback((key: string) => {
        const idx = listDataRef.current.findIndex(
            item => item.type === 'section_header' && (item as any).sectionKey === key
        );
        if (idx >= 0 && scrollViewRef.current) {
            scrollViewRef.current.scrollToIndex({ index: idx, animated: true, viewOffset: 8 });
        }
    }, []);

    // No-op kept for backward compat with any renderItem that calls it.
    const updateSectionY = useCallback((_key: string, _y: number) => {}, []);

    const getTimelineBarColor = useCallback((createdAt: string): string => {
        if (!createdAt) {return '#22C55E';}
        const created = new Date(createdAt).getTime();
        if (Number.isNaN(created)) {return '#22C55E';}
        const now = Date.now();
        const hoursElapsed = Math.max(0, (now - created) / (1000 * 60 * 60));
        if (hoursElapsed <= 12) {return '#22C55E';}   // green
        if (hoursElapsed <= 24) {return '#84CC16';}   // lime
        if (hoursElapsed <= 36) {return '#EAB308';}   // yellow
        if (hoursElapsed <= 48) {return '#F97316';}   // orange
        if (hoursElapsed <= 60) {return '#EF4444';}   // red
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


    // Stat counts must match the lists in each section + scroll targets (sectionKey).
    const messageUnreadTotal = useMemo(
        () => conversations.reduce((n, c) => n + (c.unreadCount || 0), 0),
        [conversations],
    );

    const stats = useMemo(() => [
        { label: 'Pending Vendors', value: pendingVendors.length.toString(), icon: 'account-clock', color: '#F59E0B', sectionKey: 'vendorVerification' },
        { label: 'Assign vendors', value: submittedJobs.length.toString(), icon: 'account-plus-outline', color: '#6366F1', sectionKey: 'jobRequests' },
        { label: 'In Progress', value: activeProjects.length.toString(), icon: 'progress-wrench', color: '#10B981', sectionKey: 'activeProjects' },
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
                        <Menu.Item
                            leadingIcon="account-plus-outline"
                            onPress={() => { setSettingsMenuVisible(false); navigation.navigate('InviteAdmin'); }}
                            title="Invite Admin"
                        />
                        <Divider />
                        <Menu.Item leadingIcon="logout" onPress={handleLogout} title="Logout" />
                    </Menu>
                    </View>
                </View>

                <MotiView
                    from={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'timing', duration: reducedMotion ? 0 : 400 }}
                    style={styles.profileBox}
                >
                    <Avatar.Icon size={64} icon="shield-crown-outline" style={styles.mainAvatar} color="#FFFFFF" />
                    <View style={styles.profileText}>
                        <Text variant="headlineSmall" style={styles.welcomeText}>Control Center</Text>
                        <Text variant="bodyMedium" style={styles.emailText}>{user?.email}</Text>
                    </View>
                </MotiView>

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

                <View style={styles.statsGrid}>
                    {stats.map((stat, index) => (
                        <MotiView
                            key={index}
                            from={reducedMotion ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{
                                type: 'timing',
                                duration: 400,
                                delay: reducedMotion ? 0 : 100 + index * 50,
                            }}
                            style={{ width: Math.max(0, (windowWidth - 60) / 2) }}
                        >
                            <Pressable
                                onPress={() => scrollToSection((stat as any).sectionKey)}
                                style={({ pressed }) => [
                                    styles.statCard,
                                    { width: '100%' },
                                    pressed && { opacity: 0.85 },
                                ]}
                            >
                                <Avatar.Icon size={32} icon={stat.icon} style={{ backgroundColor: stat.color + '10' }} color={stat.color} />
                                <Text variant="titleLarge" style={styles.statValue}>{stat.value}</Text>
                                <Text variant="labelSmall" style={styles.statLabel}>{stat.label}</Text>
                            </Pressable>
                        </MotiView>
                    ))}
                </View>
            </Surface>
        </View>
    ), [user, handleLogout, stats, scrollToSection, settingsMenuVisible, windowWidth]);

    const renderVendorItem = useCallback(({ item: vendor }: { item: User }) => (
        <Card style={styles.approvalCard} elevation={0}>
            <Card.Content style={styles.cardInner}>
                <View style={styles.cardHeader}>
                    <Avatar.Text
                        size={44}
                        label={(vendor.name || vendor.email || '??').substring(0, 2).toUpperCase()}
                        style={styles.vendorAvatar}
                    />
                    <View style={styles.vendorInfo}>
                        <Text variant="titleSmall" style={styles.vendorName} numberOfLines={1}>
                            {vendor.name || 'Anonymous Vendor'}
                        </Text>
                        <Text variant="labelSmall" style={styles.vendorEmail} numberOfLines={1}>
                            {vendor.email}
                        </Text>
                    </View>
                    <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
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

    const listData = useMemo<AdminDashboardDataItem[]>(() => {
        const data: AdminDashboardDataItem[] = [];
        // Header is handled by ListHeaderComponent to keep it sticky or standard

        // Inbox Section
        data.push({ type: 'section_inbox' });

        // Job Requests — show first 3 by default; reveal rest on tap
        data.push({ type: 'section_header', title: 'Job Requests', count: submittedJobs.length, sectionKey: 'jobRequests', chipColor: '#EEF2FF', chipText: 'New' });
        if (submittedJobs.length > 0) {
            const visible = showAllRequests ? submittedJobs : submittedJobs.slice(0, SECTION_PREVIEW);
            visible.forEach(j => data.push({ type: 'job_request', data: j }));
            if (submittedJobs.length > SECTION_PREVIEW) {
                data.push({ type: 'show_more_requests', hidden: submittedJobs.length - SECTION_PREVIEW });
            }
        } else {
            data.push({ type: 'empty', title: 'No new job requests.', icon: 'briefcase-check-outline' });
        }

        // Vendor Verification
        data.push({ type: 'section_header', title: 'Vendor Verification', count: pendingVendors.length, sectionKey: 'vendorVerification', chipColor: '#F1F5F9', chipText: 'New' });
        if (pendingVendors.length > 0) {
            pendingVendors.forEach(v => data.push({ type: 'vendor_verification', data: v }));
        } else {
            data.push({ type: 'empty', title: 'All vendors are verified.', icon: 'account-check-outline' });
        }

        // In Progress — show newest 3 first; expand on demand
        data.push({ type: 'section_header', title: 'In Progress', count: activeProjects.length, sectionKey: 'activeProjects', chipColor: '#ECFDF5', chipText: 'Live' });
        if (filteredActiveProjects.length > 0) {
            const visibleIP = showAllInProgress
                ? filteredActiveProjects
                : filteredActiveProjects.slice(0, SECTION_PREVIEW);
            visibleIP.forEach(j => data.push({ type: 'active_project', data: j }));
            if (filteredActiveProjects.length > SECTION_PREVIEW) {
                data.push({ type: 'show_more_inprogress', hidden: filteredActiveProjects.length - SECTION_PREVIEW });
            }
        } else if (activeProjects.length > 0) {
            data.push({ type: 'empty', title: 'No projects match your search.', icon: 'magnify-close' });
        } else {
            data.push({ type: 'empty', title: 'No active projects found.', icon: 'progress-wrench' });
        }

        // Verified Vendors
        data.push({ type: 'section_header', title: 'Verified Vendors', count: approvedVendors.length, sectionKey: 'verifiedVendors', chipColor: '#EEF2FF', chipText: 'Total' });
        if (filteredApprovedVendors.length > 0) {
            filteredApprovedVendors.forEach(v => data.push({ type: 'verified_vendor', data: v }));
        } else if (approvedVendors.length > 0) {
            data.push({ type: 'empty', title: 'No vendors match your search.', icon: 'account-search-outline' });
        } else {
            data.push({ type: 'empty', title: 'No verified vendors yet.', icon: 'account-outline' });
        }

        // Completed Jobs
        data.push({ type: 'section_header', title: 'Completed Jobs', count: completedJobs.length, sectionKey: 'completedJobs', chipColor: '#F0FDF4', chipText: 'Total' });
        if (completedJobs.length > 0) {
            completedJobs.forEach(j => data.push({ type: 'completed_job', data: j }));
        } else {
            data.push({ type: 'empty', title: 'No completed jobs yet.', icon: 'check-circle-outline' });
        }

        return data;
    }, [conversations, submittedJobs, pendingVendors, activeProjects, filteredActiveProjects, approvedVendors, filteredApprovedVendors, completedJobs, showAllRequests, showAllInProgress]);

    // Keep the ref in sync so scrollToSection always has the latest indices.
    listDataRef.current = listData;

    const renderItem = useCallback(({ item, index }: { item: AdminDashboardDataItem, index: number }) => {
        const wrapInMoti = (content: React.ReactNode) => (
            <MotiView
                from={reducedMotion ? { opacity: 1, translateY: 0 } : { opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: reducedMotion ? 0 : index * 50 }}
            >
                {content}
            </MotiView>
        );

        switch (item.type) {
            case 'section_inbox':
                return wrapInMoti(
                    <View style={styles.messagesSection}>
                        <Surface style={styles.messagesPanel} elevation={0}>
                            <View style={styles.messagesPanelInner}>
                            <View style={styles.messagesPanelHeader}>
                                <View style={styles.messagesPanelTitleBlock}>
                                    <View style={styles.messagesPanelTitleRow}>
                                        <View style={styles.messagesPanelIconWrap}>
                                            <Icon source="forum-outline" size={22} color="#475569" />
                                        </View>
                                        <View style={styles.messagesPanelTitles}>
                                            <Text variant="titleMedium" style={styles.messagesPanelTitle}>Inbox</Text>
                                            <Text variant="labelSmall" style={styles.messagesPanelSubtitle}>Messages from vendors and users</Text>
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
                                    const timeStr = c.timestamp ? new Date(c.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
                                    return (
                                        <React.Fragment key={String(c.otherUserId)}>
                                            {index > 0 ? <Divider style={styles.messageRowDivider} /> : null}
                                            <Pressable
                                                onPress={() => navigation.navigate('Chat', { otherUserId: String(c.otherUserId), otherUserName: c.otherUserName || 'User' })}
                                                style={({ pressed }) => [styles.messageListRow, pressed && styles.messageListRowPressed]}
                                            >
                                                <Avatar.Text size={48} label={(c.otherUserName || c.otherUserEmail || '?').substring(0, 2).toUpperCase()} style={styles.messageListAvatar} labelStyle={styles.messageListAvatarLabel} />
                                                <View style={styles.messageListBody}>
                                                    <View style={styles.messageListTopLine}>
                                                        <Text variant="titleSmall" style={[styles.messageListName, unread > 0 && styles.messageListNameUnread]} numberOfLines={1}>{c.otherUserName || c.otherUserEmail || 'User'}</Text>
                                                        <View style={styles.messageListTopEnd}>
                                                            {unread > 0 && <View style={styles.messageUnreadPill}><Text style={styles.messageUnreadPillText}>{unread}</Text></View>}
                                                            <Text style={styles.messageListTime} numberOfLines={1}>{timeStr}</Text>
                                                        </View>
                                                    </View>
                                                    <Text variant="bodySmall" style={[styles.messageListPreview, unread > 0 && styles.messageListPreviewUnread]} numberOfLines={2}>{formatChatPreview(c.latestMessage || '') || 'No preview'}</Text>
                                                </View>
                                                <IconButton icon="chevron-right" size={20} iconColor="#CBD5E1" style={styles.messageChevron} />
                                            </Pressable>
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <View style={styles.messagesEmptyInner}>
                                    <IconButton icon="email-outline" size={40} iconColor="#CBD5E1" />
                                    <Text variant="titleSmall" style={styles.messagesEmptyTitle}>No messages yet</Text>
                                </View>
                            )}
                            </View>
                        </Surface>
                    </View>
                );
            case 'section_header':
                return wrapInMoti(
                    <View onLayout={(e) => updateSectionY(item.sectionKey, e.nativeEvent.layout.y)}>
                        <View style={styles.sectionHeaderBar}>
                            <Text variant="titleLarge" style={styles.sectionTitle}>{item.title}</Text>
                            <Chip style={{ backgroundColor: item.chipColor }}>{item.count} {item.chipText}</Chip>
                        </View>
                        {item.sectionKey === 'verifiedVendors' && (
                            <View style={styles.vendorSearchWrap}>
                                <Searchbar
                                    placeholder="Search by name, email or phone…"
                                    value={vendorSearch}
                                    onChangeText={setVendorSearch}
                                    style={styles.vendorSearchBar}
                                    inputStyle={styles.searchInput}
                                    iconColor="#6366F1"
                                    placeholderTextColor="#94A3B8"
                                    elevation={0}
                                />
                                {vendorSearch.trim() ? (
                                    <Text style={styles.vendorSearchCount}>
                                        {filteredApprovedVendors.length} of {approvedVendors.length} vendors
                                    </Text>
                                ) : null}
                            </View>
                        )}
                        {item.sectionKey === 'activeProjects' && (
                            <View style={styles.vendorSearchWrap}>
                                <Searchbar
                                    placeholder="Search by address, vendor or service…"
                                    value={inProgressSearch}
                                    onChangeText={setInProgressSearch}
                                    style={styles.vendorSearchBar}
                                    inputStyle={styles.searchInput}
                                    iconColor="#10B981"
                                    placeholderTextColor="#94A3B8"
                                    elevation={0}
                                />
                                {inProgressSearch.trim() ? (
                                    <Text style={[styles.vendorSearchCount, { color: '#10B981' }]}>
                                        {filteredActiveProjects.length} of {activeProjects.length} projects
                                    </Text>
                                ) : null}
                            </View>
                        )}
                    </View>
                );
            case 'job_request':
                const job = item.data;
                return wrapInMoti(
                    <Card style={styles.approvalCard} elevation={0} onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}>
                        <Card.Content style={styles.cardInnerFlush}>
                            <View style={styles.requestCardRow}>
                                <View style={{ backgroundColor: getTimelineBarColor(job.createdAt), width: 6, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }} />
                                <View style={styles.requestCardContent}>
                                    <View style={[styles.vendorInfo, { marginLeft: 0, marginRight: 0 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                            <Text variant="labelSmall" style={{ color: '#6366F1', fontWeight: '900' }}>#{job.jobNumber}</Text>
                                            <Text variant="titleMedium" style={[styles.vendorName, { flex: 1 }]} numberOfLines={1}>{job.address}</Text>
                                        </View>
                                        <Text variant="labelSmall" style={{ color: '#64748B', fontWeight: 'bold' }}>{job.customer?.name || 'Homeowner'}</Text>
                                        {job.services && job.services.length > 0 && (
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 4 }}>
                                                {job.services.map(s => (
                                                    <View key={s} style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                        <Text style={{ fontSize: 9, color: '#6366F1', fontWeight: 'bold' }}>{s.toUpperCase()}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        <Text variant="labelSmall" style={[styles.vendorEmail, { flex: 1 }]} numberOfLines={1}>{job.description}</Text>
                                        {(() => {
                                            const partsDone = (job.childJobs || []).filter(c => c?.vendorId);
                                            const remainingSvc = job.services?.length || 0;
                                            const itemsLeft = (job.items || []).filter(i => i && !i.isAssigned).length;
                                            const stillNeedsVendor = remainingSvc > 0 || itemsLeft > 0;
                                            if (!stillNeedsVendor) {return null;}
                                            const partsLine = partsDone
                                                .map(c => `#${c.jobNumber ?? ''}${c.jobSuffix || ''} → ${c.vendor?.name || 'Vendor'}`)
                                                .join(' • ');
                                            const assignLine =
                                                remainingSvc > 0
                                                    ? `Still needs vendor assignment: ${(job.services || []).join(', ')}`
                                                    : `Still needs vendor assignment for ${itemsLeft} item(s).`;
                                            return (
                                                <Surface style={styles.partialAssignNotice} elevation={0}>
                                                    {partsLine.length > 0 ? (
                                                        <Text variant="labelSmall" style={styles.partialAssignParts}>
                                                            {partsLine}
                                                        </Text>
                                                    ) : null}
                                                    <Text variant="labelSmall" style={styles.partialAssignMain}>
                                                        {assignLine}
                                                    </Text>
                                                </Surface>
                                            );
                                        })()}
                                    </View>
                                    <View style={styles.actionColumn}>
                                        <Button mode="contained" compact onPress={() => navigation.navigate('AssignVendor', { jobId: job.id })} style={styles.jobActionBtn} icon="account-plus-outline" labelStyle={{ fontSize: 11 }}>Assign</Button>
                                    </View>
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                );
            case 'vendor_verification':
                return wrapInMoti(renderVendorItem({ item: item.data }));
            case 'active_project': {
                const activeJob = item.data;

                // When this is a child (split) job, pull address/customer from
                // the parent so the card shows the original customer request context.
                const isChildJob = Boolean(activeJob.parentJobId);
                const parentJob = isChildJob
                    ? jobsDeduped.find(j => String(j.id) === String(activeJob.parentJobId))
                    : null;
                const displayAddress  = parentJob?.address  ?? activeJob.address;
                const displayCustomer = parentJob?.customer ?? activeJob.customer;
                const displayJobNum   = parentJob
                    ? `${parentJob.jobNumber}${activeJob.jobSuffix ?? ''}`
                    : String(activeJob.jobNumber ?? '');

                // Use this job's OWN status (child's status is the live one)
                const pipelineIdx = getPipelineIndex(activeJob.status);
                const currentStep = pipelineIdx >= 0 ? VENDOR_PIPELINE[pipelineIdx] : null;

                // Vendor: child jobs carry vendorId directly; fall back to nested object
                const vendorName =
                    activeJob.vendor?.name ||
                    activeJob.childJobs?.find((c: any) => c?.vendor?.name)?.vendor?.name ||
                    null;

                // Navigate to the actual job (child or parent)
                const detailJobId = activeJob.id;
                // Reassign: always open the ROOT job in reassign mode
                const rootJobId = parentJob?.id ?? activeJob.id;

                return wrapInMoti(
                    <Card style={styles.inProgressCard} elevation={0}>
                        <Card.Content style={styles.cardInner}>
                            {/* ── Scope label for split jobs ── */}
                            {isChildJob && (
                                <View style={styles.splitScopeBanner}>
                                    <IconButton icon="call-split" size={12} iconColor="#7C3AED" style={{ margin: 0, padding: 0, marginRight: 2 }} />
                                    <Text style={styles.splitScopeText}>
                                        Scope {activeJob.jobSuffix || ''} · {(activeJob.services || []).join(', ') || 'Split assignment'}
                                    </Text>
                                </View>
                            )}

                            {/* ── Top row: job number + address + status badge ── */}
                            <View style={styles.inProgressTopRow}>
                                <View style={[
                                    styles.inProgressIconWrap,
                                    { backgroundColor: (currentStep?.color ?? '#6366F1') + '18' },
                                ]}>
                                    <IconButton
                                        icon={currentStep?.icon ?? 'progress-wrench'}
                                        size={18}
                                        iconColor={currentStep?.color ?? '#6366F1'}
                                        style={{ margin: 0, padding: 0 }}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.inProgressJobNum}>#{displayJobNum}</Text>
                                        <Text variant="titleSmall" style={styles.inProgressAddress} numberOfLines={1}>
                                            {displayAddress}
                                        </Text>
                                    </View>
                                    <Text variant="labelSmall" style={styles.inProgressCustomer}>
                                        {displayCustomer?.name || 'Homeowner'}
                                    </Text>
                                    {vendorName && (
                                        <View style={styles.inProgressVendorRow}>
                                            <Avatar.Text
                                                size={16}
                                                label={vendorName.substring(0, 2).toUpperCase()}
                                                style={styles.inProgressVendorAvatar}
                                                labelStyle={{ fontSize: 7 }}
                                                color="#4338CA"
                                            />
                                            <Text style={styles.inProgressVendorName}>{vendorName}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* ── Progress pipeline — shows vendor's real current step ── */}
                            <StatusPipeline currentStatus={activeJob.status} />

                            {/* ── Service chips ── */}
                            {activeJob.services && activeJob.services.length > 0 && (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                    {activeJob.services.map((s: string) => (
                                        <View key={s} style={styles.inProgressServiceChip}>
                                            <Text style={styles.inProgressServiceChipText}>{s.toUpperCase()}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* ── Action buttons ── */}
                            <View style={styles.inProgressActions}>
                                <Button
                                    mode="outlined"
                                    compact
                                    onPress={() => navigation.navigate('AssignVendor', { jobId: rootJobId, reassignMode: true })}
                                    style={styles.reassignBtn}
                                    labelStyle={{ fontSize: 11, color: '#EF4444' }}
                                    icon="account-sync"
                                    textColor="#EF4444"
                                >
                                    Reassign
                                </Button>
                                <Button
                                    mode="outlined"
                                    compact
                                    onPress={() => navigation.navigate('JobDetails', { jobId: detailJobId })}
                                    style={styles.viewDetailsBtn}
                                    labelStyle={{ fontSize: 11 }}
                                    icon="eye-outline"
                                >
                                    View Details
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>
                );
            }
            case 'verified_vendor':
                const vVendor = item.data;
                return wrapInMoti(
                    <Card style={styles.approvalCard} elevation={0}>
                        <Card.Content style={styles.cardInner}>
                            <View style={styles.cardHeader}>
                                <Avatar.Text
                                    size={44}
                                    label={(vVendor.name || vVendor.email || '??').substring(0, 2).toUpperCase()}
                                    style={{ backgroundColor: '#F0FDF4' }}
                                    color="#15803D"
                                />
                                <View style={styles.vendorInfo}>
                                    <Text variant="titleSmall" style={styles.vendorName} numberOfLines={1}>
                                        {vVendor.name || 'Anonymous Vendor'}
                                    </Text>
                                    <Text variant="labelSmall" style={styles.vendorEmail} numberOfLines={1}>
                                        {vVendor.email}
                                    </Text>
                                </View>
                                <View style={styles.verifiedBadge}>
                                    <Text style={styles.verifiedBadgeText}>✓  Verified</Text>
                                </View>
                            </View>
                            <View style={styles.cardActions}>
                                <Button
                                    mode="outlined"
                                    onPress={() => handleRemoveVendor(vVendor.id || '')}
                                    style={styles.denyBtn}
                                    textColor="#EF4444"
                                    icon="trash-can-outline"
                                    compact
                                >
                                    Remove Vendor
                                </Button>
                            </View>
                        </Card.Content>
                    </Card>
                );
            case 'completed_job': {
                const compJob = item.data;
                const isInvoiced = compJob.status === JobStatus.INVOICED;
                const isInvoiceRequested = compJob.status === JobStatus.INVOICE_REQUESTED;
                const compVendorName =
                    compJob.vendor?.name ||
                    compJob.childJobs?.find((c: any) => c?.vendor?.name)?.vendor?.name ||
                    null;
                const compStatusLabel = isInvoiced
                    ? 'Invoiced'
                    : isInvoiceRequested
                    ? 'Invoice Requested'
                    : 'Completed';
                const compStatusColor = isInvoiced ? '#0EA5E9' : isInvoiceRequested ? '#8B5CF6' : '#059669';
                const compStatusIcon  = isInvoiced ? 'file-check-outline' : isInvoiceRequested ? 'receipt-outline' : 'check-decagram';

                return wrapInMoti(
                    <Card style={styles.approvalCard} elevation={0} onPress={() => navigation.navigate('JobDetails', { jobId: compJob.id })}>
                        <Card.Content style={styles.cardInner}>
                            <View style={styles.cardHeader}>
                                <Avatar.Icon size={40} icon={compStatusIcon} style={{ backgroundColor: compStatusColor + '15' }} color={compStatusColor} />
                                <View style={styles.vendorInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                        <Text variant="labelSmall" style={{ color: '#6366F1', fontWeight: '900' }}>#{compJob.jobNumber}</Text>
                                        <Text variant="titleMedium" style={[styles.vendorName, { flex: 1 }]} numberOfLines={1}>{compJob.address}</Text>
                                    </View>
                                    <Text variant="labelSmall" style={{ color: '#94A3B8' }}>
                                        {compJob.customer?.name || 'Homeowner'}
                                    </Text>
                                    {compVendorName && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                            <Avatar.Text size={14} label={compVendorName.substring(0, 2).toUpperCase()} style={{ backgroundColor: '#F0FDF4' }} color="#059669" labelStyle={{ fontSize: 6 }} />
                                            <Text variant="labelSmall" style={{ color: '#059669', fontWeight: '700' }}>{compVendorName}</Text>
                                        </View>
                                    )}
                                    {compJob.services && compJob.services.length > 0 && (
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                            {compJob.services.map((s: string) => (
                                                <View key={s} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                    <Text style={{ fontSize: 9, color: '#64748B', fontWeight: 'bold' }}>{s.toUpperCase()}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                    <View style={[styles.statusBadge, { backgroundColor: compStatusColor + '15', borderColor: compStatusColor + '50' }]}>
                                        <Text style={[styles.statusBadgeText, { color: compStatusColor }]}>{compStatusLabel.toUpperCase()}</Text>
                                    </View>
                                    <IconButton icon="chevron-right" size={18} style={{ margin: 0 }} />
                                </View>
                            </View>
                        </Card.Content>
                    </Card>
                );
            }
            case 'show_more_requests':
                return (
                    <View style={styles.showMoreWrap}>
                        <Pressable style={styles.showMoreBtn} onPress={() => setShowAllRequests(v => !v)}>
                            <Text style={styles.showMoreText}>
                                {showAllRequests ? 'Show less' : `Show ${item.hidden} more request${item.hidden !== 1 ? 's' : ''}`}
                            </Text>
                            <IconButton icon={showAllRequests ? 'chevron-up' : 'chevron-down'} size={16} iconColor="#6366F1" style={{ margin: 0 }} />
                        </Pressable>
                    </View>
                );
            case 'show_more_inprogress':
                return (
                    <View style={styles.showMoreWrap}>
                        <Pressable style={[styles.showMoreBtn, { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' }]} onPress={() => setShowAllInProgress(v => !v)}>
                            <Text style={[styles.showMoreText, { color: '#059669' }]}>
                                {showAllInProgress ? 'Show less' : `Show ${item.hidden} more project${item.hidden !== 1 ? 's' : ''}`}
                            </Text>
                            <IconButton icon={showAllInProgress ? 'chevron-up' : 'chevron-down'} size={16} iconColor="#059669" style={{ margin: 0 }} />
                        </Pressable>
                    </View>
                );
            case 'empty':
                return wrapInMoti(
                    <View style={styles.emptyBox}>
                        <IconButton icon={item.icon} size={48} iconColor="#E2E8F0" />
                        <Text variant="bodyLarge" style={styles.emptyText}>{item.title}</Text>
                    </View>
                );
            default:
                return null;
        }
    }, [navigation, getTimelineBarColor, handleApproval, handleRemoveVendor, updateSectionY, conversations, messageUnreadTotal, jobsDeduped, vendorSearch, setVendorSearch, filteredApprovedVendors, approvedVendors, inProgressSearch, setInProgressSearch, filteredActiveProjects, activeProjects, showAllRequests, setShowAllRequests, showAllInProgress, setShowAllInProgress]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AdminList
                ref={scrollViewRef}
                data={listData}
                renderItem={renderItem}
                keyExtractor={(item: any, index: number) => {
                    const dataId = item.data?.id;
                    const sectionKey = item.sectionKey;
                    return item.type + (dataId || sectionKey || index);
                }}
                estimatedItemSize={200}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.scrollContent}
                extraData={[pendingVendors, approvedVendors, filteredApprovedVendors, vendorSearch, filteredActiveProjects, inProgressSearch, showAllRequests, showAllInProgress, conversations, filteredJobs, refreshing]}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
                }
            />

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
        marginBottom: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    showMoreWrap: {
        marginHorizontal: 16,
        marginBottom: 8,
    },
    showMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        backgroundColor: '#EEF2FF',
        gap: 2,
    },
    showMoreText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4F46E5',
    },
    vendorSearchWrap: {
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        marginBottom: 12,
    },
    vendorSearchBar: {
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 44,
    },
    vendorSearchCount: {
        fontSize: 11,
        color: '#6366F1',
        fontWeight: '700',
        marginTop: 6,
        marginLeft: 4,
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
        marginHorizontal: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInner: {
        padding: 16,
    },
    /** Use on cards where content must bleed to the card edge (e.g. the coloured left bar on job-request cards). */
    cardInnerFlush: {
        padding: 0,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 0,
    },
    vendorAvatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorInfo: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    vendorEmail: {
        color: '#94A3B8',
    },
    verifiedBadge: {
        backgroundColor: '#F0FDF4',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#BBF7D0',
        alignSelf: 'center',
    },
    verifiedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803D',
    },
    pendingChip: {
        backgroundColor: '#FFFBEB',
        height: 24,
    },
    pendingBadge: {
        backgroundColor: '#FFFBEB',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#FDE68A',
        alignSelf: 'center',
    },
    pendingBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#92400E',
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
        marginTop: 12,
    },
    approveBtn: {
        flex: 1,
        borderRadius: 10,
        backgroundColor: '#10B981',
    },
    denyBtn: {
        flex: 1,
        borderRadius: 10,
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
        minHeight: 80,
        overflow: 'hidden',
        borderRadius: 16,
    },
    timelineBar: {
        width: 6,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    requestCardContent: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 14,
        paddingLeft: 14,
        paddingRight: 14,
        alignItems: 'center',
        gap: 10,
    },
    actionColumn: {
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    jobActionBtn: {
        borderRadius: 10,
        backgroundColor: '#6366F1',
        elevation: 0,
    },
    partialAssignNotice: {
        marginTop: 8,
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    partialAssignParts: {
        color: '#92400E',
        marginBottom: 4,
    },
    partialAssignMain: {
        color: '#B45309',
        fontWeight: '700',
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
    },
    messagesPanelInner: {
        borderRadius: 16,
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
        paddingRight: 12,
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
        marginLeft: 4,
        alignSelf: 'center',
        flexShrink: 0,
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
    activeProjectActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reassignBtn: {
        borderRadius: 10,
        borderColor: '#FCA5A5',
        flex: 1,
    },
    // ── In-Progress card ──────────────────────────────────────────────────────
    inProgressCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    inProgressTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    inProgressIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginRight: 12,
    },
    inProgressJobNum: {
        color: '#6366F1',
        fontWeight: '900',
        fontSize: 11,
    },
    inProgressAddress: {
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
    },
    inProgressCustomer: {
        color: '#94A3B8',
        marginTop: 2,
    },
    inProgressVendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
    },
    inProgressVendorAvatar: {
        backgroundColor: '#EEF2FF',
    },
    inProgressVendorName: {
        fontSize: 11,
        color: '#4338CA',
        fontWeight: '700',
    },
    inProgressServiceChip: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    inProgressServiceChipText: {
        fontSize: 9,
        color: '#10B981',
        fontWeight: '700',
    },
    inProgressActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    viewDetailsBtn: {
        borderRadius: 10,
        flex: 1,
    },
    // ── Split-scope banner (shown on child-job cards) ─────────────────────────
    splitScopeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 8,
        alignSelf: 'flex-start',
    },
    splitScopeText: {
        fontSize: 10,
        color: '#7C3AED',
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    // ── Status badge (used in both In-Progress and Completed cards) ───────────
    statusBadge: {
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 7,
        paddingVertical: 3,
        alignSelf: 'flex-start',
        flexShrink: 0,
    },
    statusBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
});

export default React.memo(AdminDashboard);
