import * as React from 'react';
import { useMemo, memo, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, Card, Button, Avatar, IconButton, Searchbar, Surface, Snackbar, Chip, Checkbox, Divider, TextInput } from 'react-native-paper';
import { ScrollView, TouchableOpacity, Platform } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { RouteProp, useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList, User, Job } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { jobService } from '../services/jobService';
import { normalizeJob } from '../utils/normalization';

type AssignVendorRouteProp = RouteProp<RootStackParamList, 'AssignVendor'>;

const AnyFlashList = FlashList as any;

/** List GET often omits nested children; detail GET includes ChildJobs + vendors for assignment UI. */
/** Union child rows by id so a stale detail fetch cannot drop a split the client just created. */
function mergeChildJobs(remote?: Job[] | null, ctx?: Job[] | null): Job[] {
    const byId = new Map<string, Job>();
    for (const c of remote || []) {
        if (c?.id) {byId.set(String(c.id), c);}
    }
    for (const c of ctx || []) {
        if (!c?.id) {continue;}
        const id = String(c.id);
        const prev = byId.get(id);
        byId.set(id, prev ? ({ ...prev, ...c } as Job) : c);
    }
    return Array.from(byId.values());
}

function mergeAssignJob(ctx?: Job, remote?: Job | null): Job | undefined {
    if (!ctx && !remote) {return undefined;}
    if (!remote) {return ctx;}
    if (!ctx) {return remote;}
    return {
        ...ctx,
        ...remote,
        childJobs: mergeChildJobs(remote.childJobs, ctx.childJobs),
        items: ctx.items && ctx.items.length > 0 ? ctx.items : remote.items,
        services: Array.isArray(remote.services) ? remote.services : ctx.services,
        vendorId: remote.vendorId ?? ctx.vendorId,
        vendor: remote.vendor ?? ctx.vendor,
        description: remote.description || ctx.description,
        address: remote.address || ctx.address,
        jobNumber: remote.jobNumber ?? ctx.jobNumber,
        jobSuffix: remote.jobSuffix ?? ctx.jobSuffix,
        status: remote.status || ctx.status,
    } as Job;
}
type AssignedVendorGroup = {
    vendorId: string;
    vendor?: User;
    assignmentJobIds: string[];
    services: string[];
    scopeLabels: string[];
};

const VendorItem = memo(({ item, onAssign, isLoading, assignedData }: { item: User, onAssign: (vendorId: string) => void, isLoading: boolean, assignedData?: { scope: string, services: string[] } }) => {
    const isAssigned = Boolean(assignedData);
    const initials = (item.name || item.email || 'V').substring(0, 2).toUpperCase();

    return (
        <View style={[styles.vendorCard, isAssigned && styles.vendorCardAssigned]}>
            {/* Left accent bar — only visible when assigned */}
            {isAssigned && <View style={styles.vendorCardAccent} />}

            <View style={styles.vendorCardInner}>
                {/* ── Top row: avatar · name/email · badge ── */}
                <View style={styles.vcTopRow}>
                    <Avatar.Text
                        size={46}
                        label={initials}
                        style={[styles.vcAvatar, isAssigned && styles.vcAvatarAssigned]}
                        color={isAssigned ? '#4F46E5' : '#64748B'}
                    />

                    <View style={styles.vcNameBlock}>
                        <Text style={styles.vcName} numberOfLines={1}>
                            {item.name || 'Vendor'}
                        </Text>
                        <Text style={styles.vcEmail} numberOfLines={1}>
                            {item.email}
                        </Text>
                    </View>

                    {isAssigned && (
                        <View style={styles.vcAssignedBadge}>
                            <Text style={styles.vcAssignedBadgeText}>✓  Assigned</Text>
                        </View>
                    )}
                </View>

                {/* ── Scope line (only when assigned) ── */}
                {assignedData?.scope ? (
                    <View style={styles.vcScopeRow}>
                        <Text style={styles.vcScopeText} numberOfLines={2}>
                            {assignedData.scope}
                        </Text>
                    </View>
                ) : null}

                {/* ── Service chips ── */}
                {assignedData?.services && assignedData.services.length > 0 && (
                    <View style={styles.vcChipsRow}>
                        {assignedData.services.map(s => (
                            <View key={s} style={styles.vcServiceChip}>
                                <Text style={styles.vcServiceChipText}>{s.toUpperCase()}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Bottom row: rating · action button ── */}
                <View style={styles.vcBottomRow}>
                    <View style={styles.vcRatingRow}>
                        <Text style={styles.vcStar}>★</Text>
                        <Text style={styles.vcRatingText}>4.9 · Verified Partner</Text>
                    </View>

                    {!isAssigned && (
                        <TouchableOpacity
                            onPress={() => onAssign(item.id!)}
                            disabled={isLoading}
                            style={styles.vcBtn}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.vcBtnText}>Assign</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
});

function AssignmentPhotoThumbnails({ urls }: { urls?: string[] | null }) {
    if (!urls?.length) {return null;}
    return (
        <View style={styles.assignmentPhotoRow}>
            <View style={styles.assignmentPhotoLabelRow}>
                <IconButton icon="image-move" size={14} iconColor="#7C3AED" style={{ margin: 0, padding: 0, marginRight: 2 }} />
                <Text variant="labelSmall" style={styles.assignmentPhotoLabel}>
                    Assigned Photos ({urls.length})
                </Text>
            </View>
            <View style={styles.assignmentPhotoGrid}>
                {urls.map(uri => (
                    <View key={uri} style={styles.assignmentPhotoThumbWrapper}>
                        <FastImage source={{ uri }} style={styles.assignmentPhotoThumb} />
                        <View style={styles.assignmentPhotoMovedBadge}>
                            <IconButton icon="check" size={10} iconColor="#FFFFFF" style={{ margin: 0, padding: 0 }} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

const AssignVendorScreen: React.FC = () => {
    const route = useRoute<AssignVendorRouteProp>();
    const navigation = useNavigation();
    const jobId = route.params?.jobId;
    const reassignMode = route.params?.reassignMode === true;
    const { getApprovedVendors } = useAuth();
    const { jobs, partialAssign, getJobById, finalizeAssignment, unassignVendor, unassignVendorScope, refreshJobs } = useJobs();

    const [vendors, setVendors] = React.useState<User[]>([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const [selectedItemIds, setSelectedItemIds] = React.useState<string[]>([]);
    const [selectedPhotoUrls, setSelectedPhotoUrls] = React.useState<string[]>([]);
    const [selectedServiceNames, setSelectedServiceNames] = React.useState<string[]>([]);
    const [sessionAssignments, setSessionAssignments] = React.useState<
        Record<string, { scope: string; services: string[]; photoUrls?: string[] }>
    >({});
    /** Photos removed from the Target Job card and moved to a vendor in this session. */
    const [assignedOutPhotoUrls, setAssignedOutPhotoUrls] = React.useState<Set<string>>(new Set());
    const [isFinalizing, setIsFinalizing] = React.useState(false);
    const navigationTimeoutRef = React.useRef<any>(null);

    // Refs to keep handleAssign stable and avoid re-renders while typing
    const selectedItemIdsRef = React.useRef(selectedItemIds);
    const selectedPhotoUrlsRef = React.useRef(selectedPhotoUrls);
    const selectedServiceNamesRef = React.useRef(selectedServiceNames);

    const [remoteJob, setRemoteJob] = React.useState<Job | null>(null);

    // Sync refs with state
    React.useEffect(() => { selectedItemIdsRef.current = selectedItemIds; }, [selectedItemIds]);
    React.useEffect(() => { selectedPhotoUrlsRef.current = selectedPhotoUrls; }, [selectedPhotoUrls]);
    React.useEffect(() => { selectedServiceNamesRef.current = selectedServiceNames; }, [selectedServiceNames]);

    const jobFromContext = jobId ? getJobById(jobId) : undefined;
    const job = useMemo(
        () => mergeAssignJob(jobFromContext, remoteJob),
        [jobFromContext, remoteJob],
    );

    /**
     * Photos still on the Target Job card.
     * Filters out photos that have already been moved to a vendor this session
     * so the UI updates instantly without waiting for the next API round-trip.
     */
    const displayPhotos = useMemo(
        () => (job?.photos || []).filter(url => !assignedOutPhotoUrls.has(url)),
        [job?.photos, assignedOutPhotoUrls],
    );

    const loadJobDetail = useCallback(async () => {
        if (!jobId) {
            setRemoteJob(null);
            return;
        }
        try {
            const raw = await jobService.getJobById(jobId);
            setRemoteJob(normalizeJob(raw));
        } catch {
            setRemoteJob(null);
        }
    }, [jobId]);

    useFocusEffect(
        useCallback(() => {
            let cancelled = false;
            (async () => {
                await refreshJobs();
                if (!jobId || cancelled) {return;}
                try {
                    const raw = await jobService.getJobById(jobId);
                    if (!cancelled) {setRemoteJob(normalizeJob(raw));}
                } catch {
                    if (!cancelled) {setRemoteJob(null);}
                }
            })();
            return () => {
                cancelled = true;
            };
        }, [refreshJobs, jobId]),
    );

    // Child rows may only exist nested on the parent (admin GET) and not as top-level list entries.
    const splitAssignments = useMemo(() => {
        if (!jobId) {return [] as Job[];}
        const byId = new Map<string, Job>();
        const pid = String(jobId);
        jobs
            .filter(j => j?.vendorId && (j.parentJobId === jobId || String(j.parentJobId) === pid))
            .forEach(j => {
                if (j.id) {byId.set(j.id, j);}
            });
        (job?.childJobs || []).forEach(c => {
            if (!c?.id || !c.vendorId || byId.has(c.id)) {return;}
            const cid = String(c.parentJobId || '');
            if (cid && cid !== pid && c.parentJobId !== jobId) {return;}
            byId.set(c.id, c);
        });
        return Array.from(byId.values());
    }, [jobs, jobId, job?.childJobs]);

    const assignedServicesFromSplits = useMemo(() => {
        const names = new Set<string>();
        splitAssignments.forEach(a => (a.services || []).forEach(s => names.add(s)));
        return Array.from(names);
    }, [splitAssignments]);

    const assignedVendorGroups = useMemo<AssignedVendorGroup[]>(() => {
        const byVendor = new Map<string, AssignedVendorGroup>();

        splitAssignments.forEach(assignment => {
            if (!assignment.vendorId) {return;}
            const vid = String(assignment.vendorId);
            const existing = byVendor.get(vid);
            const nextServices = Array.from(new Set([
                ...(existing?.services || []),
                ...((assignment.services || []).filter(Boolean)),
            ]));
            const scopeLabel = assignment.jobSuffix
                ? `Part ${assignment.jobNumber}${assignment.jobSuffix}`
                : `Part ${assignment.jobNumber}`;

            const resolvedVendor =
                assignment.vendor ||
                existing?.vendor ||
                vendors.find(v => v.id && String(v.id) === vid);
            byVendor.set(vid, {
                vendorId: vid,
                vendor: resolvedVendor,
                assignmentJobIds: [...(existing?.assignmentJobIds || []), assignment.id!],
                services: nextServices,
                scopeLabels: [...(existing?.scopeLabels || []), scopeLabel],
            });
        });

        if (job?.vendorId) {
            const vid = String(job.vendorId);
            const existing = byVendor.get(vid);
            byVendor.set(vid, {
                vendorId: vid,
                vendor: job.vendor || existing?.vendor || vendors.find(v => v.id && String(v.id) === vid),
                assignmentJobIds: existing?.assignmentJobIds || [job.id],
                services: existing?.services || (job.services || []),
                scopeLabels: existing?.scopeLabels || [`Job #${job.jobNumber}`],
            });
        }

        return Array.from(byVendor.values());
    }, [splitAssignments, job, vendors]);

    const hasRemainingServices = useMemo(
        () => Array.isArray(job?.services) && job.services.length > 0,
        [job?.services]
    );
    const remainingServicesCount = useMemo(
        () => (Array.isArray(job?.services) ? job.services.length : 0),
        [job?.services]
    );
    const hasUnassignedItems = useMemo(
        () => Array.isArray(job?.items) && job.items.some(i => i && !i.isAssigned),
        [job?.items]
    );
    const remainingItemsCount = useMemo(
        () => (Array.isArray(job?.items) ? job.items.filter(i => i && !i.isAssigned).length : 0),
        [job?.items]
    );
    const hasRemainingTargetWork = hasRemainingServices || hasUnassignedItems;

    // Initialize with all unassigned items (re-run when vendor is cleared so splits reset in UI)
    React.useEffect(() => {
        if (job?.items) {
            const unassigned = job.items.filter(i => !i.isAssigned).map(i => i.id);
            setSelectedItemIds(unassigned);
        }
    }, [job?.id, job?.vendorId]);

    const toggleService = useCallback((name: string) => {
        setSelectedServiceNames(prev =>
            prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
        );
    }, []);

    React.useEffect(() => {
        getApprovedVendors().then(setVendors);
    }, [getApprovedVendors]);

    const activeAssignmentsByVendor = useMemo<Record<string, { scope: string, services: string[] }>>(() => {
        const persisted = assignedVendorGroups.reduce((acc, group) => {
            acc[group.vendorId] = {
                scope: group.scopeLabels.join(', '),
                services: group.services,
            };
            return acc;
        }, {} as Record<string, { scope: string, services: string[] }>);

        return {
            ...persisted,
            ...sessionAssignments,
        };
    }, [assignedVendorGroups, sessionAssignments]);

    const filteredVendors = useMemo(() => vendors.filter(v =>
        v.id &&
        !activeAssignmentsByVendor[v.id] &&
        (v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchQuery.toLowerCase()))
    ), [vendors, searchQuery, activeAssignmentsByVendor]);

    /** Session-only vendors (not yet merged into assignedVendorGroups from API). */
    const sessionOnlyVendorIds = useMemo(
        () =>
            Object.keys(sessionAssignments).filter(
                id => !assignedVendorGroups.some(g => String(g.vendorId) === String(id)),
            ),
        [sessionAssignments, assignedVendorGroups],
    );

    const showExistingAssignmentsPanel =
        assignedVendorGroups.length > 0 || sessionOnlyVendorIds.length > 0 || splitAssignments.length > 0;

    const handleUnassign = useCallback((group: AssignedVendorGroup) => {
        if (!jobId) {return;}

        const vendorName = group.vendor?.name || 'this vendor';
        const scopeLabel = group.services.length > 0
            ? group.services.join(', ')
            : group.scopeLabels.join(', ');

        // Collect photos that will be returned to the Target Job card on unassign.
        // We gather them now (in the closure) so they are available after the async call.
        const gid = String(group.vendorId);
        const photosToRestore = Array.from(new Set([
            ...(sessionAssignments[gid]?.photoUrls || []),
            ...splitAssignments
                .filter(a => a.vendorId && String(a.vendorId) === gid)
                .flatMap(a => a.photos || []),
        ])).filter(Boolean);

        Alert.alert(
            'Unassign Vendor',
            `Remove ${vendorName} from: ${scopeLabel}? Their assigned scope will return to the Target Job card.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unassign',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const isSplitScope = splitAssignments.some(
                                a => String(a.vendorId) === String(group.vendorId),
                            );
                            if (isSplitScope) {
                                await unassignVendorScope(jobId, group.vendorId);
                            } else {
                                await unassignVendor(jobId);
                            }

                            setSessionAssignments(prev => {
                                const next = { ...prev };
                                delete next[group.vendorId];
                                return next;
                            });

                            // Restore photos back to the Target Job card immediately (optimistic).
                            if (photosToRestore.length > 0) {
                                setAssignedOutPhotoUrls(prev => {
                                    const next = new Set(prev);
                                    photosToRestore.forEach(url => next.delete(url));
                                    return next;
                                });
                            }

                            setSelectedServiceNames([]);
                            setSnackbarMessage('Vendor unassigned — photos returned to job card.');
                            setSnackbarVisible(true);
                            await loadJobDetail();
                        } catch (error: any) {
                            setSnackbarMessage(error.message || 'Failed to unassign');
                            setSnackbarVisible(true);
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    }, [jobId, splitAssignments, sessionAssignments, unassignVendorScope, unassignVendor, loadJobDetail]);

    const handleAssign = useCallback(async (vendorId: string) => {
        if (!jobId) {return;}

        const hasItems = job?.items && job.items.length > 0;

        // Validation: must have either an item, a photo, or a selected service category
        if (selectedItemIdsRef.current.length === 0 && selectedServiceNamesRef.current.length === 0 && selectedPhotoUrlsRef.current.length === 0) {
            setSnackbarMessage('Please select at least one item or service category to assign');
            setSnackbarVisible(true);
            return;
        }

        // Use selected services as the automated scope if no manual input exists
        const currentScope = selectedServiceNamesRef.current.length > 0
            ? selectedServiceNamesRef.current.join(', ')
            : 'Assigned Tasks';

        setIsLoading(true);
        try {
            // Capture selected photos before clearing so we can track them as moved-out.
            const movedPhotos = selectedPhotoUrlsRef.current.filter(Boolean);

            await partialAssign(
                jobId,
                vendorId,
                selectedItemIdsRef.current,
                selectedPhotoUrlsRef.current,
                currentScope,
                selectedServiceNamesRef.current
            );

            // Optimistically remove the selected photos from the Target Job card BEFORE
            // the API refetch so the UI updates instantly (no stale-flash of old photos).
            if (movedPhotos.length > 0) {
                setAssignedOutPhotoUrls(prev => {
                    const next = new Set(prev);
                    movedPhotos.forEach(url => next.add(url));
                    return next;
                });
            }

            await loadJobDetail();
            setSnackbarMessage(`Assigned for: ${currentScope}`);
            setSnackbarVisible(true);

            // Add to session assignments to update UI feedback (shows photos in vendor card)
            setSessionAssignments(prev => {
                const existing = prev[vendorId] || { scope: '', services: [], photoUrls: [] };
                const updatedScope = existing.scope ? `${existing.scope}, ${currentScope}` : currentScope;
                const updatedServices = Array.from(new Set([...existing.services, ...selectedServiceNamesRef.current]));
                const updatedPhotos =
                    movedPhotos.length > 0
                        ? Array.from(new Set([...(existing.photoUrls || []), ...movedPhotos]))
                        : existing.photoUrls;
                return {
                    ...prev,
                    [vendorId]: {
                        scope: updatedScope,
                        services: updatedServices,
                        ...(updatedPhotos && updatedPhotos.length > 0 ? { photoUrls: updatedPhotos } : {}),
                    },
                };
            });

            // Clear current selection to prepare for next split
            setSelectedServiceNames([]);
            setSelectedPhotoUrls([]);
            if (hasItems) {
                setSelectedItemIds([]);
            }
        } catch (error: any) {
            setSnackbarMessage(error.message || 'Failed to assign vendor');
            setSnackbarVisible(true);
        } finally {
            setIsLoading(false);
        }
    }, [jobId, partialAssign, job?.items, loadJobDetail]);

    const handleFinalize = useCallback(async () => {
        if (!jobId) {return;}
        if (hasRemainingTargetWork) {
            setSnackbarMessage('You still need to assign the other job request items.');
            setSnackbarVisible(true);
            return;
        }
        setIsFinalizing(true);
        try {
            await finalizeAssignment(jobId);
            setSnackbarMessage('Finalized! Job moved to active status.');
            setSnackbarVisible(true);
            setTimeout(() => {
                navigation.goBack();
            }, 1000);
        } catch (error: any) {
            setSnackbarMessage(error.message || 'Failed to finalize');
            setSnackbarVisible(true);
            setIsFinalizing(false);
        }
    }, [jobId, finalizeAssignment, navigation, hasRemainingTargetWork]);

    const toggleItem = (id: string) => {
        setSelectedItemIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const togglePhoto = (url: string) => {
        setSelectedPhotoUrls(prev =>
            prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
        );
    };

    React.useEffect(() => {
        return () => {
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, []);

    const renderHeaderContent = useCallback(() => (
        <View>
            {showExistingAssignmentsPanel && (
                <Surface style={styles.existingAssignmentsPanel} elevation={2}>
                    <Text variant="titleSmall" style={styles.existingAssignmentsTitle}>
                        Existing vendor assignments
                    </Text>
                    <Text variant="bodySmall" style={styles.existingAssignmentsSubtitle}>
                        Vendors already working this request and what each one covers.
                    </Text>

                    {assignedVendorGroups.map(group => {
                        const gid = String(group.vendorId);
                        const currentVendor =
                            group.vendor || vendors.find(v => v.id && String(v.id) === gid);
                        const vendorLabel = currentVendor?.name || currentVendor?.email || 'Vendor';
                        const partsForVendor = splitAssignments.filter(
                            a => a.vendorId && String(a.vendorId) === gid,
                        );
                        const isParentDirect = Boolean(
                            job?.vendorId &&
                                String(job.vendorId) === gid &&
                                partsForVendor.length === 0,
                        );

                        return (
                            <View key={group.vendorId} style={styles.existingVendorBlock}>
                                <Card style={styles.existingVendorCard} elevation={0}>
                                    <Card.Content style={styles.cardInnerContent}>
                                        <View style={styles.vendorMainRow}>
                                            <Avatar.Text
                                                size={48}
                                                label={vendorLabel.substring(0, 2).toUpperCase()}
                                                style={styles.existingVendorAvatar}
                                                color="#312E81"
                                            />
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text variant="titleMedium" style={styles.existingVendorName}>
                                                    {vendorLabel}
                                                </Text>
                                                <Text variant="labelSmall" style={styles.existingVendorEmail} numberOfLines={1}>
                                                    {currentVendor?.email || ''}
                                                </Text>
                                            </View>
                                            <Chip compact style={styles.existingVendorChip} textStyle={styles.existingVendorChipText}>
                                                Assigned
                                            </Chip>
                                        </View>
                                    </Card.Content>
                                </Card>

                                <Surface style={styles.assignmentDetailPanel} elevation={0}>
                                    <Text variant="labelSmall" style={styles.assignmentDetailHeading}>
                                        Assignment details
                                    </Text>
                                    {partsForVendor.length > 0 ? (
                                        partsForVendor.map(part => {
                                            const partServiceNames = (part.services || []).map(s => s.toLowerCase());
                                            const extraDesc = part.description &&
                                                !partServiceNames.includes(part.description.trim().toLowerCase())
                                                ? part.description : null;
                                            return (
                                                <View key={part.id} style={styles.assignmentPartRow}>
                                                    <Text style={styles.assignmentPartLabel}>
                                                        #{part.jobNumber}{part.jobSuffix || ''}
                                                        {part.status ? `  ·  ${part.status}` : ''}
                                                    </Text>
                                                    {Array.isArray(part.services) && part.services.length > 0 && (
                                                        <View style={styles.detailServiceChips}>
                                                            {part.services.map(s => (
                                                                <View key={s} style={styles.detailServiceChip}>
                                                                    <Text style={styles.detailServiceChipText}>{s}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                    <AssignmentPhotoThumbnails urls={part.photos} />
                                                    {extraDesc ? (
                                                        <Text variant="bodySmall" style={styles.assignmentPartDesc} numberOfLines={4}>
                                                            {extraDesc}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            );
                                        })
                                    ) : isParentDirect && job ? (
                                        <View style={styles.assignmentPartRow}>
                                            <Text style={styles.assignmentPartLabel}>
                                                Job #{job.jobNumber}  ·  Main request
                                            </Text>
                                            {group.services.length > 0 && (
                                                <View style={styles.detailServiceChips}>
                                                    {group.services.map(s => (
                                                        <View key={s} style={styles.detailServiceChip}>
                                                            <Text style={styles.detailServiceChipText}>{s}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            <AssignmentPhotoThumbnails urls={job.photos} />
                                        </View>
                                    ) : (
                                        <View style={styles.assignmentPartRow}>
                                            {group.services.length > 0 && (
                                                <View style={styles.detailServiceChips}>
                                                    {group.services.map(s => (
                                                        <View key={s} style={styles.detailServiceChip}>
                                                            <Text style={styles.detailServiceChipText}>{s}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            {group.scopeLabels.length > 0 && (
                                                <Text variant="bodySmall" style={styles.assignmentPartDesc}>
                                                    {group.scopeLabels.join(' · ')}
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </Surface>

                                <Button
                                    mode="outlined"
                                    onPress={() => handleUnassign(group)}
                                    compact
                                    textColor="#EF4444"
                                    style={styles.existingUnassignBtn}
                                    labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
                                    icon="account-minus-outline"
                                >
                                    Unassign vendor
                                </Button>
                            </View>
                        );
                    })}

                    {sessionOnlyVendorIds.map(vendorId => {
                        const v = vendors.find(x => x.id === vendorId);
                        const data = sessionAssignments[vendorId];
                        const vendorLabel = v?.name || v?.email || 'Vendor';
                        return (
                            <View key={`session-${vendorId}`} style={styles.existingVendorBlock}>
                                <Card style={styles.existingVendorCard} elevation={0}>
                                    <Card.Content style={styles.cardInnerContent}>
                                        <View style={styles.vendorMainRow}>
                                            <Avatar.Text
                                                size={48}
                                                label={vendorLabel.substring(0, 2).toUpperCase()}
                                                style={styles.existingVendorAvatar}
                                                color="#312E81"
                                            />
                                            <View style={{ flex: 1, marginLeft: 12 }}>
                                                <Text variant="titleMedium" style={styles.existingVendorName}>
                                                    {vendorLabel}
                                                </Text>
                                                <Text variant="labelSmall" style={styles.existingVendorEmail} numberOfLines={1}>
                                                    {v?.email || ''}
                                                </Text>
                                            </View>
                                            <Chip compact style={styles.sessionVendorChip} textStyle={styles.sessionVendorChipText}>
                                                This session
                                            </Chip>
                                        </View>
                                    </Card.Content>
                                </Card>
                                <Surface style={styles.assignmentDetailPanel} elevation={0}>
                                    <Text variant="labelSmall" style={styles.assignmentDetailHeading}>
                                        Assignment details
                                    </Text>
                                    {data?.services && data.services.length > 0 ? (
                                        <View style={styles.detailServiceChips}>
                                            {data.services.map(s => (
                                                <Chip key={s} compact style={styles.detailServiceChip} textStyle={styles.detailServiceChipText}>
                                                    {s}
                                                </Chip>
                                            ))}
                                        </View>
                                    ) : null}
                                    <AssignmentPhotoThumbnails urls={data?.photoUrls} />
                                    {data?.scope ? (
                                        <Text variant="bodySmall" style={styles.assignmentPartDesc}>
                                            {data.scope}
                                        </Text>
                                    ) : null}
                                </Surface>
                            </View>
                        );
                    })}
                </Surface>
            )}

            <View style={styles.jobInfo}>
                <Surface style={styles.jobChip} elevation={1}>
                    <Text variant="labelSmall" style={styles.jobLabel}>TARGET JOB #{job?.jobNumber}</Text>
                    <Text variant="titleMedium" style={styles.jobAddress}>{job?.address || 'Loading...'}</Text>

                    {assignedServicesFromSplits.length > 0 && (
                        <View style={styles.targetAssignedWrap}>
                            <Text variant="labelSmall" style={styles.targetAssignedLabel}>
                                Already assigned to vendors
                            </Text>
                            <View style={styles.targetAssignedChips}>
                                {assignedServicesFromSplits.map(s => (
                                    <Chip key={s} compact style={styles.targetAssignedChip} textStyle={styles.targetAssignedChipText}>
                                        {s}
                                    </Chip>
                                ))}
                            </View>
                        </View>
                    )}

                    {job?.services && job.services.length > 0 && (
                        <View style={{ marginTop: 12 }}>
                            <Text variant="labelSmall" style={{ color: '#64748B', fontWeight: 'bold', marginBottom: 6, opacity: 0.8 }}>SERVICES REQUESTED (Select to Assign)</Text>
                            <View style={{ gap: 2 }}>
                                {job.services.map(s => {
                                    const isSelected = selectedServiceNames.includes(s);
                                    return (
                                        <TouchableOpacity
                                            key={s}
                                            onPress={() => toggleService(s)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: isSelected ? '#F0F9FF' : '#FFFFFF',
                                                paddingHorizontal: 12,
                                                paddingVertical: 10,
                                                borderRadius: 12,
                                                borderWidth: 1,
                                                borderColor: isSelected ? '#6366F1' : '#E2E8F0',
                                                marginBottom: 4,
                                            }}
                                        >
                                            <Checkbox
                                                status={isSelected ? 'checked' : 'unchecked'}
                                                color="#6366F1"
                                            />
                                            <Text style={{
                                                fontSize: 13,
                                                color: isSelected ? '#1E293B' : '#64748B',
                                                fontWeight: isSelected ? 'bold' : '500',
                                                textTransform: 'capitalize',
                                                flex: 1,
                                                marginLeft: 8,
                                            }}>
                                                {s}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    <Divider style={{ marginVertical: 12 }} />

                    {Array.isArray(job?.items) && job.items.length > 0 ? (
                        <>
                            <Text variant="labelMedium" style={styles.selectionTitle}>Select Items to Assign</Text>
                            {job.items.map((item, idx) => item && (
                                <View key={item.id || idx} style={styles.itemSelectionRow}>
                                    <Checkbox
                                        status={selectedItemIds.includes(item.id) ? 'checked' : 'unchecked'}
                                        onPress={() => !item.isAssigned && toggleItem(item.id)}
                                        disabled={Boolean(item.isAssigned)}
                                        color="#6366F1"
                                    />
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        <Text variant="bodyMedium" style={[item.isAssigned && { textDecorationLine: 'line-through', color: '#94A3B8' }]}>
                                            {item.title}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: '#64748B' }} numberOfLines={1}>
                                            {item.description}
                                        </Text>
                                    </View>
                                    {item.isAssigned && <Chip compact style={{ height: 20 }} textStyle={{ fontSize: 9 }}>Assigned</Chip>}
                                </View>
                            ))}
                        </>
                    ) : null}

                    <Divider style={{ marginVertical: 12 }} />

                    <View style={styles.photoSectionHeader}>
                        <IconButton icon="image-move" size={16} iconColor="#7C3AED" style={{ margin: 0, padding: 0, marginRight: 4 }} />
                        <Text variant="labelMedium" style={styles.selectionTitle}>
                            Assign Photos to Vendor
                        </Text>
                        {selectedPhotoUrls.length > 0 && (
                            <View style={styles.photoSelectionBadge}>
                                <Text style={styles.photoSelectionBadgeText}>
                                    {selectedPhotoUrls.length} will move to vendor ↗
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text variant="bodySmall" style={styles.photoSectionHint}>
                        Selected photos are removed from this card and placed in the vendor's assignment.
                    </Text>
                    <View style={styles.photoGrid}>
                        {displayPhotos.length > 0 ? (
                            displayPhotos.map((url, index) => (
                                <TouchableOpacity
                                    key={`${url}-${index}`}
                                    style={[
                                        styles.photoItem,
                                        selectedPhotoUrls.includes(url) && styles.photoItemSelected,
                                    ]}
                                    onPress={() => togglePhoto(url)}
                                    activeOpacity={0.8}
                                >
                                    <FastImage source={{ uri: url }} style={styles.photoImage} />
                                    <View style={[
                                        styles.photoOverlay,
                                        selectedPhotoUrls.includes(url) && styles.photoOverlaySelected,
                                    ]}>
                                        <Checkbox
                                            status={selectedPhotoUrls.includes(url) ? 'checked' : 'unchecked'}
                                            color="#6366F1"
                                        />
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (job?.photos && job.photos.length > 0 ? (
                            <View style={styles.allPhotosMovedBox}>
                                <IconButton icon="check-circle-outline" size={28} iconColor="#10B981" style={{ margin: 0 }} />
                                <Text variant="bodySmall" style={styles.allPhotosMovedText}>
                                    All photos have been assigned to vendors
                                </Text>
                            </View>
                        ) : (
                            <Text variant="bodySmall" style={{ color: '#94A3B8' }}>No photos attached to this job</Text>
                        ))}
                    </View>
                </Surface>
            </View>

            <View style={styles.searchSection}>
                <Text variant="titleMedium" style={styles.sectionHeaderTitle}>Select Vendor</Text>

                <Searchbar
                    placeholder="Search verified vendors..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    style={styles.searchBar}
                    elevation={0}
                />
            </View>
        </View>
    ), [
        job,
        selectedItemIds,
        selectedPhotoUrls,
        displayPhotos,
        assignedOutPhotoUrls,
        searchQuery,
        toggleItem,
        togglePhoto,
        setSearchQuery,
        vendors,
        selectedServiceNames,
        toggleService,
        handleUnassign,
        assignedVendorGroups,
        splitAssignments,
        showExistingAssignmentsPanel,
        sessionOnlyVendorIds,
        sessionAssignments,
        assignedServicesFromSplits,
    ]);

    if (!jobId) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="chevron-left" size={24} onPress={() => navigation.goBack()} />
                    <Text variant="titleLarge" style={styles.title}>Assign Vendor</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text variant="bodyLarge">Missing job information.</Text>
                    <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                        Go back
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton icon="chevron-left" size={24} onPress={() => navigation.goBack()} />
                <Text variant="titleLarge" style={styles.title}>
                    {reassignMode ? 'Reassign Vendor' : 'Assign Vendor'}
                </Text>
                <View style={styles.headerSpacer} />
            </View>

            <AnyFlashList
                data={filteredVendors}
                keyExtractor={(item: any) => item.id!}
                contentContainerStyle={styles.listContent}
                estimatedItemSize={120}
                ListHeaderComponent={renderHeaderContent}
                renderItem={({ item }: any) => (
                    <VendorItem
                        item={item}
                        onAssign={handleAssign}
                        isLoading={isLoading}
                        assignedData={activeAssignmentsByVendor[item.id!]}
                    />
                )}
                extraData={[
                    activeAssignmentsByVendor,
                    isLoading,
                    selectedItemIds,
                    selectedPhotoUrls,
                    searchQuery,
                    assignedVendorGroups,
                    splitAssignments,
                    showExistingAssignmentsPanel,
                    sessionOnlyVendorIds,
                ]}
                ListEmptyComponent={() => (
                    <View style={styles.emptyBox}>
                        <IconButton icon="account-search-outline" size={48} iconColor="#E2E8F0" />
                        <Text variant="bodyLarge" style={styles.emptyText}>No verified vendors found.</Text>
                    </View>
                )}
            />

            {/* Sticky Footer for Final Action */}
            <Surface style={styles.footer} elevation={4}>
                {/* Vendor-visibility notice */}
                <View style={styles.vendorGateNotice}>
                    <IconButton icon="eye-off-outline" size={14} iconColor="#7C3AED" style={{ margin: 0, padding: 0, marginRight: 4 }} />
                    <Text style={styles.vendorGateText}>
                        Vendors cannot see staged assignments until you tap{' '}
                        <Text style={{ fontWeight: '800' }}>Mark Fully Assigned</Text>
                    </Text>
                </View>

                <View style={styles.footerContent}>
                    <View style={styles.footerTextWrap}>
                        <Text variant="labelSmall" style={styles.footerLabel}>SESSION SUMMARY</Text>
                        <Text variant="titleSmall" style={styles.footerSummary}>
                            {Object.keys(activeAssignmentsByVendor).length}{' '}
                            {Object.keys(activeAssignmentsByVendor).length === 1 ? 'vendor' : 'vendors'} staged
                        </Text>
                        {hasRemainingTargetWork && (
                            <Text variant="labelSmall" style={styles.footerWarning}>
                                Remaining: {remainingServicesCount} {remainingServicesCount === 1 ? 'service' : 'services'}
                                {' • '}
                                {remainingItemsCount} {remainingItemsCount === 1 ? 'item' : 'items'}
                            </Text>
                        )}
                    </View>
                    <Button
                        mode="contained"
                        onPress={handleFinalize}
                        loading={isFinalizing}
                        disabled={isLoading || isFinalizing}
                        style={styles.finalizeBtn}
                        contentStyle={styles.finalizeBtnContent}
                        buttonColor="#1E293B"
                        icon="send-check"
                    >
                        Mark Fully Assigned
                    </Button>
                </View>
            </Surface>

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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerSpacer: {
        width: 40,
    },
    title: {
        flex: 1,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
    },
    jobInfo: {
        marginVertical: 16,
    },
    jobChip: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    jobLabel: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    jobAddress: {
        color: '#1E293B',
        fontWeight: 'bold',
    },
    existingAssignmentsPanel: {
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    existingAssignmentsTitle: {
        fontWeight: '900',
        color: '#1E1B4B',
        marginBottom: 4,
    },
    existingAssignmentsSubtitle: {
        color: '#4338CA',
        marginBottom: 16,
    },
    existingVendorBlock: {
        marginBottom: 16,
    },
    existingVendorCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#A5B4FC',
        marginBottom: 10,
    },
    existingVendorAvatar: {
        backgroundColor: '#E0E7FF',
    },
    existingVendorName: {
        fontWeight: '800',
        color: '#1E1B4B',
    },
    existingVendorEmail: {
        color: '#4338CA',
        marginTop: 2,
    },
    existingVendorChip: {
        backgroundColor: '#E0E7FF',
        alignSelf: 'center',
        marginLeft: 8,
    },
    existingVendorChipText: {
        fontSize: 11,
        lineHeight: 14,
        color: '#3730A3',
        fontWeight: '700',
        marginVertical: 0,
    },
    sessionVendorChip: {
        backgroundColor: '#FEF3C7',
        alignSelf: 'center',
        marginLeft: 8,
    },
    sessionVendorChipText: {
        fontSize: 11,
        lineHeight: 14,
        color: '#92400E',
        fontWeight: '700',
        marginVertical: 0,
    },
    assignmentDetailPanel: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 10,
    },
    assignmentDetailHeading: {
        color: '#64748B',
        fontWeight: 'bold',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    assignmentPartRow: {
        marginBottom: 4,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    assignmentPartLabel: {
        fontSize: 13,
        color: '#312E81',
        fontWeight: '700',
        marginBottom: 0,
    },
    detailServiceChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 6,
        marginBottom: 8,
    },
    assignmentPhotoRow: {
        marginTop: 8,
        marginBottom: 4,
        backgroundColor: '#F5F3FF',
        borderRadius: 10,
        padding: 8,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    assignmentPhotoLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    assignmentPhotoLabel: {
        color: '#6D28D9',
        fontWeight: '700',
        fontSize: 11,
    },
    assignmentPhotoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    assignmentPhotoThumbWrapper: {
        position: 'relative',
    },
    assignmentPhotoThumb: {
        width: 64,
        height: 64,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#7C3AED',
        backgroundColor: '#F1F5F9',
    },
    assignmentPhotoMovedBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#10B981',
        borderRadius: 10,
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailServiceChip: {
        backgroundColor: '#EEF2FF',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    detailServiceChipText: {
        fontSize: 11,
        color: '#4338CA',
        fontWeight: '700',
    },
    assignmentPartDesc: {
        color: '#475569',
        lineHeight: 20,
    },
    existingUnassignBtn: {
        borderColor: '#FCA5A5',
        borderRadius: 10,
    },
    searchBar: {
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 140,
    },
    targetAssignedWrap: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    targetAssignedLabel: {
        color: '#166534',
        fontWeight: 'bold',
        marginBottom: 8,
        opacity: 0.9,
    },
    targetAssignedChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    targetAssignedChip: {
        backgroundColor: '#DCFCE7',
        borderColor: '#86EFAC',
        height: 28,
    },
    targetAssignedChipText: {
        fontSize: 11,
        color: '#15803D',
        fontWeight: '700',
    },
    selectionTitle: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    itemSelectionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 4,
    },
    photoSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    photoSelectionBadge: {
        marginLeft: 8,
        backgroundColor: '#EDE9FE',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: '#C4B5FD',
    },
    photoSelectionBadgeText: {
        fontSize: 10,
        color: '#6D28D9',
        fontWeight: '700',
    },
    photoSectionHint: {
        color: '#94A3B8',
        fontSize: 11,
        marginBottom: 10,
        fontStyle: 'italic',
    },
    allPhotosMovedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        gap: 8,
    },
    allPhotosMovedText: {
        color: '#10B981',
        fontWeight: '600',
    },
    photoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    photoItem: {
        width: 80,
        height: 80,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    photoItemSelected: {
        borderColor: '#6366F1',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    photoOverlay: {
        position: 'absolute',
        top: -8,
        right: -8,
        transform: [{ scale: 0.8 }],
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderRadius: 12,
    },
    photoOverlaySelected: {
        backgroundColor: 'rgba(99,102,241,0.15)',
    },
    searchSection: {
        marginBottom: 12,
        marginTop: 8,
    },
    sectionHeaderTitle: {
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 8,
    },
    /* ─── Vendor card (VendorItem) ─────────────────────── */
    vendorCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        overflow: 'hidden',
        // shadow
        shadowColor: '#94A3B8',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    vendorCardAssigned: {
        backgroundColor: '#FAFAFF',
        borderColor: '#C7D2FE',
    },
    vendorCardAccent: {
        width: 4,
        backgroundColor: '#6366F1',
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    vendorCardInner: {
        flex: 1,
        padding: 14,
        gap: 10,
    },
    vcTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    vcAvatar: {
        backgroundColor: '#F1F5F9',
    },
    vcAvatarAssigned: {
        backgroundColor: '#EEF2FF',
    },
    vcNameBlock: {
        flex: 1,
    },
    vcName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 2,
    },
    vcEmail: {
        fontSize: 12,
        color: '#64748B',
    },
    vcAssignedBadge: {
        backgroundColor: '#F0FDF4',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    vcAssignedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#15803D',
    },
    vcScopeRow: {
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    vcScopeText: {
        fontSize: 12,
        color: '#4338CA',
        fontWeight: '600',
    },
    vcChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    vcServiceChip: {
        backgroundColor: '#F0F9FF',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    vcServiceChipText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0369A1',
        letterSpacing: 0.4,
    },
    vcBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 2,
    },
    vcRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    vcStar: {
        fontSize: 13,
        color: '#F59E0B',
    },
    vcRatingText: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    vcBtn: {
        backgroundColor: '#4F46E5',
        borderRadius: 10,
        paddingHorizontal: 18,
        paddingVertical: 8,
    },
    vcBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    /* ─── (legacy aliases kept for existing-panel cards) ─ */
    cardInnerContent: {
        padding: 12,
    },
    vendorMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    assignBtn: {
        borderRadius: 8,
        marginLeft: 8,
        minWidth: 70,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#94A3B8',
    },
    snackbar: {
        borderRadius: 12,
        backgroundColor: '#1E293B',
    },
    currentChip: {
        backgroundColor: '#EEF2FF',
    },
    currentChipText: {
        color: '#6366F1',
        fontSize: 10,
        fontWeight: 'bold' as const,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16, // SafeArea padding
    },
    vendorGateNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F5F3FF',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 5,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    vendorGateText: {
        flex: 1,
        fontSize: 11,
        color: '#5B21B6',
        lineHeight: 15,
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerTextWrap: {
        flex: 1,
    },
    footerLabel: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    footerSummary: {
        color: '#1E293B',
        fontWeight: '900',
    },
    footerWarning: {
        marginTop: 4,
        color: '#B45309',
        fontWeight: '700',
    },
    finalizeBtn: {
        borderRadius: 12,
        minWidth: 160,
    },
    finalizeBtnContent: {
        height: 48,
    },
});

export default AssignVendorScreen;
