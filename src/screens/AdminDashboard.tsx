import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, RefreshControl, Pressable, useWindowDimensions, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, Button, Avatar, Divider, Surface, IconButton, Chip, Snackbar, Portal, Menu, Dialog, Searchbar, TextInput } from 'react-native-paper';
import { apiClient } from '../services/apiClient';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import AppLogo from '../components/AppLogo';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, User, Job, JobStatus, Conversation } from '../types/types';
import { messageService } from '../services/messageService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useJobs } from '../context/JobContext';
import { JobErrorBanner } from '../components/JobErrorBanner';

import { VendorApprovalCard } from './admin/VendorApprovalCard';
import { JobRequestCard } from './admin/JobRequestCard';
import { ActiveProjectCard } from './admin/ActiveProjectCard';
import { AdminInboxSection } from './admin/AdminInboxSection';
import { VerifiedVendorCard } from './admin/VerifiedVendorCard';
import { CompletedJobCard } from './admin/CompletedJobCard';

type NavigationProp = StackNavigationProp<RootStackParamList>;

export type AdminDashboardDataItem =
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
    const [makeAdminVisible, setMakeAdminVisible] = React.useState(false);
    const [makeAdminEmail, setMakeAdminEmail] = React.useState('');
    const [makeAdminLoading, setMakeAdminLoading] = React.useState(false);
    const SECTION_PREVIEW = 3;

    // Guards async setState: these fetches can resolve after the screen unmounts (navigation
    // away mid-request), which would otherwise warn about setState on an unmounted component.
    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const fetchData = useCallback(async () => {
        setRefreshing(true);
        try {
            const [pending, approved, conv] = await Promise.all([
                getPendingVendors(),
                getApprovedVendors(),
                messageService.getConversations().catch(() => [] as Conversation[]),
            ]);
            if (!isMountedRef.current) { return; }
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
        if (isMountedRef.current) { setRefreshing(false); }
    }, [getPendingVendors, getApprovedVendors, refreshJobs]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Opening Chat marks messages read on the server; refetch inbox when returning so unread pills clear.
    const refreshInbox = useCallback(async () => {
        try {
            const conv = await messageService.getConversations().catch(() => [] as Conversation[]);
            if (!isMountedRef.current) { return; }
            const sorted = [...(conv || [])].sort(
                (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime(),
            );
            setConversations(sorted);
        } catch {
            /* ignore */
        }
    }, []);

    // Permanently removes a conversation (admin only) after confirmation.
    const handleDeleteConversation = useCallback((otherUserId: string, otherUserName: string) => {
        Alert.alert(
            'Delete conversation',
            `Permanently delete the conversation with ${otherUserName}? This removes all messages for both sides and cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const ok = await messageService.deleteConversation(otherUserId);
                        if (ok) {
                            setConversations(prev => prev.filter(c => String(c.otherUserId) !== otherUserId));
                        } else {
                            Alert.alert('Delete failed', 'Could not delete the conversation. Please try again.');
                        }
                    },
                },
            ],
        );
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
     * Defined below collectActiveChildren (which it depends on) — see submittedJobs there.
     */

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
     * A split PARENT whose scopes are all finished: it has children, none are still active,
     * and nothing on the parent remains to assign. Such a parent lingers in Submitted/
     * PartiallyAssigned forever, so without this it keeps showing as a "Job Request" with the
     * Split/Assign actions even though the work is done. Excluded from Job Requests below.
     */
    const isFullyHandledSplitParent = useCallback((j: Job): boolean => {
        const active = collectActiveChildren(j, ACTIVE_STATUSES);
        const done = collectActiveChildren(j, DONE_STATUSES);
        if (active.length + done.length === 0) {return false;} // not a split parent
        if (active.length > 0) {return false;}                  // still has live scopes
        const remainingSvc = j.services?.length || 0;
        const itemsLeft = (j.items || []).filter(i => i && !i.isAssigned).length;
        return remainingSvc === 0 && itemsLeft === 0;
    }, [collectActiveChildren, ACTIVE_STATUSES, DONE_STATUSES]);

    /** "Job Requests" — Submitted / PartiallyAssigned jobs still needing admin action. */
    const submittedJobs = useMemo(() => filteredJobs.filter(j =>
        (j.status === JobStatus.SUBMITTED || j.status === JobStatus.PARTIALLY_ASSIGNED)
        && !isFullyHandledSplitParent(j)
    ), [filteredJobs, isFullyHandledSplitParent]);

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

    // Memoised: the row renderers below depend on these, so an unstable identity would
    // re-create renderItem/renderVendorItem on every render and re-render every card.
    const handleApproval = useCallback(async (userId: string, approved: boolean) => {
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
        if (isMountedRef.current) { setRefreshing(false); }
    }, [updateUserStatus, fetchData]);

    const handleRemoveVendor = useCallback(async (userId: string) => {
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
        if (isMountedRef.current) { setRefreshing(false); }
    }, [removeVendor, fetchData]);

    const handleLogout = useCallback(async () => {
        setSettingsMenuVisible(false);
        await logout();
    }, [logout]);

    // Promote an EXISTING account to Admin by email (distinct from Invite Admin, which onboards a new email).
    const handlePromoteAdmin = async () => {
        const email = makeAdminEmail.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setSnackbarMessage('Please enter a valid email address.');
            setSnackbarVisible(true);
            return;
        }
        setMakeAdminLoading(true);
        try {
            const res = await apiClient.post<{ message: string }>('/admin/promote', { email });
            setMakeAdminVisible(false);
            setMakeAdminEmail('');
            setSnackbarMessage(res.message);
            setSnackbarVisible(true);
            await fetchData();
        } catch (err: any) {
            setSnackbarMessage(err?.message ?? 'Failed to promote user.');
            setSnackbarVisible(true);
        } finally {
            setMakeAdminLoading(false);
        }
    };


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

    // Built as an ELEMENT, not a component function: FlashList remounts ListHeaderComponent
    // whenever the component *type* changes, which would blow away the Searchbar's keyboard
    // focus on every keystroke. An element of the same type reconciles in place instead.
    const headerElement = useMemo(() => (
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
                        <Menu.Item
                            leadingIcon="shield-account-outline"
                            onPress={() => { setSettingsMenuVisible(false); setMakeAdminEmail(''); setMakeAdminVisible(true); }}
                            title="Make Admin"
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
    ), [user, handleLogout, stats, scrollToSection, settingsMenuVisible, windowWidth, searchQuery, reducedMotion, navigation]);

    const listData = useMemo<AdminDashboardDataItem[]>(() => {
        const data: AdminDashboardDataItem[] = [];

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
    }, [submittedJobs, pendingVendors, activeProjects, filteredActiveProjects, approvedVendors, filteredApprovedVendors, completedJobs, showAllRequests, showAllInProgress]);

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
                    <AdminInboxSection
                        conversations={conversations}
                        messageUnreadTotal={messageUnreadTotal}
                        onSelectConversation={(userId, userName) => navigation.navigate('Chat', { otherUserId: userId, otherUserName: userName })}
                        onDeleteConversation={handleDeleteConversation}
                    />
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
                return wrapInMoti(
                    <JobRequestCard
                        job={item.data}
                        onPress={(id) => navigation.navigate('JobDetails', { jobId: id })}
                        onAssign={(id) => navigation.navigate('AssignVendor', { jobId: id })}
                        timelineBarColor={getTimelineBarColor(item.data.createdAt)}
                    />
                );
            case 'vendor_verification':
                return wrapInMoti(
                    <VendorApprovalCard
                        vendor={item.data}
                        onApprove={(id) => handleApproval(id, true)}
                        onDeny={(id) => handleApproval(id, false)}
                        onChat={(v) => navigation.navigate('Chat', { otherUserId: v.id || v.email, otherUserName: v.name || 'Vendor' })}
                    />
                );
            case 'active_project':
                return wrapInMoti(
                    <ActiveProjectCard
                        job={item.data}
                        allJobs={jobsDeduped}
                        onPress={(id) => navigation.navigate('JobDetails', { jobId: id })}
                        onReassign={(rootId) => navigation.navigate('AssignVendor', { jobId: rootId, reassignMode: true })}
                    />
                );
            case 'verified_vendor':
                return wrapInMoti(
                    <VerifiedVendorCard
                        vendor={item.data}
                        onChat={(v) => navigation.navigate('Chat', { otherUserId: v.id || v.email, otherUserName: v.name || 'Vendor' })}
                        onRemoveVendor={(v) => handleRemoveVendor(v.id || '')}
                        onDeleteVendorPermanently={(v) => handleRemoveVendor(v.id || '')}
                    />
                );
            case 'completed_job':
                return wrapInMoti(
                    <CompletedJobCard
                        job={item.data}
                        onPress={(id) => navigation.navigate('JobDetails', { jobId: id })}
                    />
                );
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
    }, [navigation, getTimelineBarColor, handleApproval, handleRemoveVendor, handleDeleteConversation, updateSectionY, conversations, messageUnreadTotal, jobsDeduped, vendorSearch, setVendorSearch, filteredApprovedVendors, approvedVendors, inProgressSearch, setInProgressSearch, filteredActiveProjects, activeProjects, showAllRequests, setShowAllRequests, showAllInProgress, setShowAllInProgress, reducedMotion]);

    const adminExtraData = React.useMemo(
        () => [pendingVendors, approvedVendors, filteredApprovedVendors, vendorSearch, filteredActiveProjects, inProgressSearch, showAllRequests, showAllInProgress, conversations, filteredJobs, refreshing],
        [pendingVendors, approvedVendors, filteredApprovedVendors, vendorSearch, filteredActiveProjects, inProgressSearch, showAllRequests, showAllInProgress, conversations, filteredJobs, refreshing]
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']} testID="admin_dashboard_screen">
            <JobErrorBanner />
            <FlashList<AdminDashboardDataItem>
                ref={scrollViewRef}
                data={listData}
                renderItem={renderItem}
                keyExtractor={(item: AdminDashboardDataItem, index: number) => {
                    const dataId = 'data' in item && item.data?.id ? item.data.id : undefined;
                    const sectionKey = 'sectionKey' in item ? item.sectionKey : undefined;
                    return item.type + (dataId || sectionKey || index);
                }}
                estimatedItemSize={140}
                ListHeaderComponent={headerElement}
                contentContainerStyle={styles.scrollContent}
                extraData={adminExtraData}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
                }
            />

            <Portal>
                <Dialog visible={makeAdminVisible} onDismiss={() => setMakeAdminVisible(false)} style={{ borderRadius: 16 }}>
                    <Dialog.Title>Make Admin</Dialog.Title>
                    <Dialog.Content>
                        <Text variant="bodyMedium" style={{ color: '#64748B', marginBottom: 16 }}>
                            Enter the email of an existing account to grant Admin access. They must sign out and back in.
                        </Text>
                        <TextInput
                            label="Email address"
                            value={makeAdminEmail}
                            onChangeText={setMakeAdminEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            mode="outlined"
                            left={<TextInput.Icon icon="email-outline" />}
                        />
                    </Dialog.Content>
                    <Dialog.Actions>
                        <Button onPress={() => setMakeAdminVisible(false)} disabled={makeAdminLoading}>Cancel</Button>
                        <Button mode="contained" onPress={handlePromoteAdmin} loading={makeAdminLoading} disabled={makeAdminLoading}>
                            Make Admin
                        </Button>
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
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
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
        marginBottom: 16,
        gap: 12,
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
        marginBottom: 16,
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
    sectionHeaderBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
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
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 4,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        marginBottom: 10,
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
    sectionTitle: {
        fontWeight: '900',
        color: '#1E293B',
    },
    scrollContent: {
        paddingBottom: 40,
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
});

export default React.memo(AdminDashboard);

