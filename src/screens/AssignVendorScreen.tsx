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
        if (c?.id) byId.set(String(c.id), c);
    }
    for (const c of ctx || []) {
        if (!c?.id) continue;
        const id = String(c.id);
        const prev = byId.get(id);
        byId.set(id, prev ? ({ ...prev, ...c } as Job) : c);
    }
    return Array.from(byId.values());
}

function mergeAssignJob(ctx?: Job, remote?: Job | null): Job | undefined {
    if (!ctx && !remote) return undefined;
    if (!remote) return ctx;
    if (!ctx) return remote;
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

const VendorItem = memo(({ item, onAssign, isLoading, assignedData }: { item: User, onAssign: (vendorId: string) => void, isLoading: boolean, assignedData?: { scope: string, services: string[] } }) => (
    <Card style={[styles.vendorCard, assignedData && { borderColor: '#6366F1', borderWidth: 1.5 }]} elevation={1}>
        <Card.Content style={styles.cardInnerContent}>
            <View style={styles.vendorMainRow}>
                <Avatar.Text
                    size={48}
                    label={(item.name || item.email || 'V').substring(0, 2).toUpperCase()}
                    style={styles.avatar}
                />
                <View style={styles.vendorDetails}>
                    <View style={styles.nameRow}>
                        <Text variant="titleMedium" style={styles.vendorName} numberOfLines={1}>{item.name || 'Vendor'}</Text>
                        {assignedData && (
                            <Chip 
                                icon="check-circle" 
                                style={styles.currentChip} 
                                textStyle={styles.currentChipText}
                                compact
                            >
                                ASSIGNED
                            </Chip>
                        )}
                    </View>
                    
                    <Text variant="labelSmall" style={styles.vendorEmail} numberOfLines={1}>
                        {(assignedData && assignedData.scope) ? `Scope: ${assignedData.scope}` : item.email}
                    </Text>

                    {assignedData && assignedData.services && assignedData.services.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {assignedData.services.map(s => (
                                <View key={s} style={{ backgroundColor: '#F0F9FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#BAE6FD' }}>
                                    <Text style={{ fontSize: 9, color: '#0369A1', fontWeight: 'bold', textTransform: 'uppercase' }}>{s}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={styles.ratingRow}>
                        <IconButton icon="star" iconColor="#F59E0B" size={14} style={{ margin: 0, padding: 0 }} />
                        <Text variant="labelSmall" style={styles.ratingText}>4.9 • Verified Partner</Text>
                    </View>
                </View>

                <Button 
                    mode="contained" 
                    onPress={() => onAssign(item.id!)}
                    loading={isLoading}
                    disabled={isLoading}
                    style={styles.assignBtn}
                    labelStyle={{ fontSize: 11, fontWeight: 'bold' }}
                    contentStyle={{ height: 36 }}
                >
                    {assignedData ? 'Add' : 'Assign'}
                </Button>
            </View>
        </Card.Content>
    </Card>
));

const AssignVendorScreen: React.FC = () => {
    const route = useRoute<AssignVendorRouteProp>();
    const navigation = useNavigation();
    const jobId = route.params?.jobId;
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
    const [sessionAssignments, setSessionAssignments] = React.useState<Record<string, { scope: string, services: string[] }>>({});
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
                if (!jobId || cancelled) return;
                try {
                    const raw = await jobService.getJobById(jobId);
                    if (!cancelled) setRemoteJob(normalizeJob(raw));
                } catch {
                    if (!cancelled) setRemoteJob(null);
                }
            })();
            return () => {
                cancelled = true;
            };
        }, [refreshJobs, jobId]),
    );

    // Child rows may only exist nested on the parent (admin GET) and not as top-level list entries.
    const splitAssignments = useMemo(() => {
        if (!jobId) return [] as Job[];
        const byId = new Map<string, Job>();
        const pid = String(jobId);
        jobs
            .filter(j => j?.vendorId && (j.parentJobId === jobId || String(j.parentJobId) === pid))
            .forEach(j => {
                if (j.id) byId.set(j.id, j);
            });
        (job?.childJobs || []).forEach(c => {
            if (!c?.id || !c.vendorId || byId.has(c.id)) return;
            const cid = String(c.parentJobId || '');
            if (cid && cid !== pid && c.parentJobId !== jobId) return;
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
            if (!assignment.vendorId) return;
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

    const filteredVendors = useMemo(() => vendors.filter(v =>
        (v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchQuery.toLowerCase())) && v.id
    ), [vendors, searchQuery]);

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
        if (!jobId) return;

        const vendorName = group.vendor?.name || 'this vendor';
        const scopeLabel = group.services.length > 0
            ? group.services.join(', ')
            : group.scopeLabels.join(', ');

        Alert.alert(
            "Unassign Vendor",
            `Remove ${vendorName} from: ${scopeLabel}? Their assigned scope will return to the Target Job card.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Unassign",
                    style: "destructive",
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
                            setSelectedServiceNames([]);
                            setSnackbarMessage('Vendor unassigned and scope restored.');
                            setSnackbarVisible(true);
                            await loadJobDetail();
                        } catch (error: any) {
                            setSnackbarMessage(error.message || 'Failed to unassign');
                            setSnackbarVisible(true);
                        } finally {
                            setIsLoading(false);
                        }
                    }
                }
            ]
        );
    }, [jobId, splitAssignments, unassignVendorScope, unassignVendor, loadJobDetail]);

    const handleAssign = useCallback(async (vendorId: string) => {
        if (!jobId) return;
        
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
            await partialAssign(
                jobId, 
                vendorId, 
                selectedItemIdsRef.current, 
                selectedPhotoUrlsRef.current, 
                currentScope,
                selectedServiceNamesRef.current
            );
            await loadJobDetail();
            setSnackbarMessage(`Assigned for: ${currentScope}`);
            setSnackbarVisible(true);
            
            // Add to session assignments to update UI feedback
            setSessionAssignments(prev => {
                const existing = prev[vendorId] || { scope: '', services: [] };
                const updatedScope = existing.scope ? `${existing.scope}, ${currentScope}` : currentScope;
                const updatedServices = Array.from(new Set([...existing.services, ...selectedServiceNamesRef.current]));
                return { ...prev, [vendorId]: { scope: updatedScope, services: updatedServices } };
            });
            
            // Clear current selection to prepare for next split
            setSelectedServiceNames([]);
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
        if (!jobId) return;
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
                                        partsForVendor.map(part => (
                                            <View key={part.id} style={styles.assignmentPartRow}>
                                                <Text variant="labelMedium" style={styles.assignmentPartLabel}>
                                                    #{part.jobNumber}
                                                    {part.jobSuffix || ''}
                                                    {part.status ? ` · ${part.status}` : ''}
                                                </Text>
                                                {Array.isArray(part.services) && part.services.length > 0 ? (
                                                    <View style={styles.detailServiceChips}>
                                                        {part.services.map(s => (
                                                            <Chip key={s} compact style={styles.detailServiceChip} textStyle={styles.detailServiceChipText}>
                                                                {s}
                                                            </Chip>
                                                        ))}
                                                    </View>
                                                ) : null}
                                                {part.description ? (
                                                    <Text variant="bodySmall" style={styles.assignmentPartDesc} numberOfLines={4}>
                                                        {part.description}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ))
                                    ) : isParentDirect && job ? (
                                        <View style={styles.assignmentPartRow}>
                                            <Text variant="labelMedium" style={styles.assignmentPartLabel}>
                                                Job #{job.jobNumber} (main request)
                                            </Text>
                                            {group.services.length > 0 ? (
                                                <View style={styles.detailServiceChips}>
                                                    {group.services.map(s => (
                                                        <Chip key={s} compact style={styles.detailServiceChip} textStyle={styles.detailServiceChipText}>
                                                            {s}
                                                        </Chip>
                                                    ))}
                                                </View>
                                            ) : null}
                                            {job.description ? (
                                                <Text variant="bodySmall" style={styles.assignmentPartDesc} numberOfLines={4}>
                                                    {job.description}
                                                </Text>
                                            ) : null}
                                        </View>
                                    ) : (
                                        <View style={styles.assignmentPartRow}>
                                            {group.services.length > 0 ? (
                                                <View style={styles.detailServiceChips}>
                                                    {group.services.map(s => (
                                                        <Chip key={s} compact style={styles.detailServiceChip} textStyle={styles.detailServiceChipText}>
                                                            {s}
                                                        </Chip>
                                                    ))}
                                                </View>
                                            ) : null}
                                            <Text variant="bodySmall" style={styles.assignmentPartDesc}>
                                                {group.scopeLabels.join(' · ') || 'Scope on file'}
                                            </Text>
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
                                                marginBottom: 4
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
                                                marginLeft: 8
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
                    
                    <Text variant="labelMedium" style={styles.selectionTitle}>Select Photos to Send (Optional)</Text>
                    <View style={styles.photoGrid}>
                        {job?.photos && job.photos.length > 0 ? (
                            job.photos.map((url, index) => (
                                <TouchableOpacity 
                                    key={index}
                                    style={[
                                        styles.photoItem, 
                                        selectedPhotoUrls.includes(url) && styles.photoItemSelected
                                    ]}
                                    onPress={() => togglePhoto(url)}
                                >
                                    <FastImage source={{ uri: url }} style={styles.photoImage} />
                                    <View style={styles.photoOverlay}>
                                        <Checkbox 
                                            status={selectedPhotoUrls.includes(url) ? 'checked' : 'unchecked'}
                                            color="#6366F1"
                                        />
                                    </View>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text variant="bodySmall" style={{ color: '#94A3B8' }}>No photos available</Text>
                        )}
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
                    {showExistingAssignmentsPanel ? 'Reassign Vendor' : 'Assign Vendor'}
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
                <View style={styles.footerContent}>
                    <View style={styles.footerTextWrap}>
                        <Text variant="labelSmall" style={styles.footerLabel}>SESSION SUMMARY</Text>
                        <Text variant="titleSmall" style={styles.footerSummary}>
                            {Object.keys(activeAssignmentsByVendor).length}{' '}
                            {Object.keys(activeAssignmentsByVendor).length === 1 ? 'vendor' : 'vendors'} assigned
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
        height: 26,
    },
    existingVendorChipText: {
        fontSize: 10,
        color: '#3730A3',
        fontWeight: '700',
    },
    sessionVendorChip: {
        backgroundColor: '#FEF3C7',
        height: 26,
    },
    sessionVendorChipText: {
        fontSize: 10,
        color: '#92400E',
        fontWeight: '700',
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
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    assignmentPartLabel: {
        color: '#312E81',
        fontWeight: '700',
        marginBottom: 6,
    },
    detailServiceChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 6,
    },
    detailServiceChip: {
        backgroundColor: '#F0F9FF',
        borderColor: '#BAE6FD',
        height: 28,
    },
    detailServiceChipText: {
        fontSize: 11,
        color: '#0369A1',
        fontWeight: '600',
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
    vendorCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInnerContent: {
        padding: 12,
    },
    vendorMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorDetails: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1E293B',
        fontSize: 15,
        flex: 1,
        marginRight: 4,
    },
    vendorEmail: {
        color: '#64748B',
        fontSize: 12,
        marginBottom: 2,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -8,
    },
    ratingText: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '500',
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
        fontWeight: 'bold',
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
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16, // SafeArea padding
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
