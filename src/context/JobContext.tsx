import * as React from 'react';
import { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { Job, JobStatus, User } from '../types/types';
import { jobService } from '../services/jobService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

const STORAGE_KEY = '@jobs_cache';

/**
 * Cheap change signature for a job list. Used instead of JSON.stringify on the whole list,
 * which ran on every poll and every persist and walks nested customer/vendor/childJobs objects.
 * Covers the fields that actually change over a job's life; lengths stand in for the
 * collections so a photo/note/service add still registers.
 */
const jobsSignature = (list: Job[]): string =>
    list
        .map(j =>
            [
                j?.id,
                j?.status,
                (j as any)?.updatedAt ?? '',
                j?.vendorId ?? '',
                j?.paymentStatus ?? '',
                j?.assignedAt ?? '',
                j?.acceptedAt ?? '',
                j?.invoiceRequestedAt ?? '',
                j?.invoicedAt ?? '',
                j?.invoiceDocumentUrl ?? '',
                j?.description?.length ?? 0,
                j?.address?.length ?? 0,
                j?.photos?.length ?? 0,
                j?.completedPhotos?.length ?? 0,
                j?.notes?.length ?? 0,
                j?.services?.length ?? 0,
                j?.items?.length ?? 0,
                j?.items?.filter(i => i?.isAssigned).length ?? 0,
                j?.childJobs?.length ?? 0,
            ].join(':'),
        )
        .join('|');

/** True when the API answered 404 — i.e. this backend predates the atomic finalize endpoint. */
const isMissingEndpointError = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('404') || /not found/i.test(msg);
};

import { normalizeUser, normalizeJob } from '../utils/normalization';
import { useAuth } from './AuthContext';


interface JobContextType {
    jobs: Job[];
    addJob: (jobData: any) => Promise<void>;
    updateJob: (jobId: string, updates: Partial<Job>) => Promise<void>;
    assignVendor: (jobId: string, vendorId: string) => Promise<void>;
    acceptJob: (jobId: string) => Promise<void>;
    completeSale: (jobId: string, saleData: any) => Promise<void>;
    reachOut: (jobId: string) => Promise<void>;
    setAppointment: (jobId: string) => Promise<void>;
    completeJob: (jobId: string, photos?: string[]) => Promise<void>;
    requestInvoice: (jobId: string) => Promise<void>;
    uploadInvoice: (jobId: string, url: string) => Promise<void>;
    sendInvoice: (jobId: string) => Promise<string>;
    addJobPhotos: (jobId: string, photos: string[]) => Promise<void>;
    removeJobPhoto: (jobId: string, photoUrl: string) => Promise<void>;
    partialAssign: (jobId: string, vendorId: string, selectedItemIds: string[], selectedPhotoUrls: string[], manualDescription?: string, selectedServices?: string[]) => Promise<void>;
    finalizeAssignment: (jobId: string) => Promise<void>;
    unassignVendor: (jobId: string) => Promise<void>;
    unassignVendorScope: (parentJobId: string, vendorId: string) => Promise<void>;
    getJobById: (jobId: string) => Job | undefined;
    isLoading: boolean;
    refreshJobs: () => Promise<void>;
    error: string | null;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useRef(true);

    // Always-current mirror of `jobs` so async handlers can read the latest list without
    // closing over a stale value or depending on `jobs` (which would re-create callbacks each poll).
    const jobsRef = useRef<Job[]>(jobs);
    jobsRef.current = jobs;

    const jobsMap = useMemo(() => {
        const map = new Map<string, Job>();
        jobs.forEach(job => {
            if (job && job.id) {map.set(job.id, job);}
        });
        return map;
    }, [jobs]);

    const getJobById = useCallback((jobId: string) => {
        return jobsMap.get(jobId);
    }, [jobsMap]);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const loadJobs = useCallback(async (isRefreshing = false) => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        if (!isRefreshing) {
            // Priority 1: Load from local storage for instant display
            try {
                const cachedJobs = await AsyncStorage.getItem(STORAGE_KEY);
                if (cachedJobs && isMounted.current) {
                    const parsed = JSON.parse(cachedJobs);
                    const normalized = Array.isArray(parsed) ? parsed.map(normalizeJob) : [];
                    setJobs(normalized);
                    setIsLoading(false);
                } else if (isMounted.current) {
                    // No cache: don't keep isLoading true until InteractionManager + network (can feel like a blank screen)
                    setIsLoading(false);
                }
            } catch {
                if (isMounted.current) {
                    setIsLoading(false);
                }
            }
        }

        const fetchRemote = async () => {
            try {
                // Refreshes bypass the client GET cache — a pull-to-refresh or focus refresh
                // that returns cached data defeats its purpose (stale statuses up to 5 min).
                const remoteJobs = await jobService.getJobs(isRefreshing);
                if (isMounted.current) {
                    const jobsArray = Array.isArray(remoteJobs)
                        ? remoteJobs
                        : remoteJobs && typeof remoteJobs === 'object'
                        ? [remoteJobs]
                        : [];

                    // Flatten: backends often embed child jobs inside the parent's
                    // `childJobs` array rather than returning them as separate list
                    // entries. We hoist them to the top level so every consumer
                    // (admin progress tracker, getJobById, etc.) always sees the
                    // child's live status directly.
                    const seen = new Set<string>();
                    const flat: any[] = [];
                    const enqueue = (j: any) => {
                        if (!j?.id || seen.has(String(j.id))) {return;}
                        seen.add(String(j.id));
                        flat.push(j);
                        // Recurse into nested children
                        if (Array.isArray(j.childJobs)) {
                            j.childJobs.forEach((c: any) => enqueue(c));
                        }
                    };
                    jobsArray.forEach(enqueue);

                    const normalized = flat.map(normalizeJob);
                    // Skip the state update when the polled payload matches what we already
                    // hold. Returning the same reference prevents a new context value, which would
                    // otherwise re-render every useJobs() consumer (all dashboards + JobDetails)
                    // every 30s poll even when nothing changed.
                    const nextSignature = jobsSignature(normalized);
                    setJobs(prev =>
                        jobsSignature(prev) === nextSignature ? prev : normalized,
                    );
                    setError(null);
                }
            } catch (err) {
                if (isMounted.current) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    if (__DEV__ && !errorMsg.includes('401') && !errorMsg.toLowerCase().includes('unauthorized')) {
                        console.error('Error loading jobs:', err);
                    }
                    // Surface the failure — without this the error banner never shows and a
                    // down API looks like an empty "No jobs" dashboard.
                    if (!errorMsg.includes('401') && !errorMsg.toLowerCase().includes('unauthorized')) {
                        setError('Could not load your jobs. Pull down to retry.');
                    }
                }
            } finally {
                if (isMounted.current) {
                    setIsLoading(false);
                }
            }
        };

        // Priority 2: Fetch from API after animations complete (avoid jank).
        // The returned promise must stay pending until the data actually lands — resolving as
        // soon as the fetch was *scheduled* made pull-to-refresh hide its spinner too early.
        await new Promise<void>(resolveLoad => {
            InteractionManager.runAfterInteractions(() => {
                void fetchRemote().finally(resolveLoad);
            });
        });
    }, [user?.id]);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    const refreshJobs = useCallback(() => loadJobs(true), [loadJobs]);

    const addJob = useCallback(async (jobData: any) => {
        try {
            const newJob = await jobService.createJob(jobData);
            const normalized = normalizeJob(newJob);
            setJobs(prevJobs => [normalized, ...prevJobs]);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add job');
            throw err;
        }
    }, []);

    const updateJob = useCallback(async (jobId: string, updates: Partial<Job>) => {
        // Capture the baseline synchronously BEFORE the optimistic update. Capturing inside the
        // setJobs updater meant two racing updateJob calls clobbered the same `snapshot`, so a
        // revert could restore the wrong baseline.
        const snapshot = jobsRef.current;

        setJobs(prevJobs =>
            prevJobs.map(job =>
                job.id === jobId ? { ...job, ...updates } : job
            )
        );

        try {
            const updatedJob = await jobService.updateJob(jobId, updates);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(job =>
                job.id === jobId ? normalized : job
            ));
            setError(null);
        } catch (err: any) {
            const msg = err?.message || 'Failed to update job';
            if (__DEV__) {console.error('JobContext: Update failed:', msg);}
            // Revert to snapshot
            setJobs(snapshot);
            setError(msg);
            throw err;
        }
    }, []); // Removed jobs from dependency array to prevent stale closure issues with snapshot

    // Shared optimistic-replace helper. Runs the service call, normalizes the returned job,
    // swaps it into state by id, clears error — and on failure sets `failMessage` and rethrows.
    // Collapses ~10 identical try/catch handlers below into one place.
    const mutateJob = useCallback(async (
        jobId: string,
        call: () => Promise<any>,
        failMessage: string,
    ): Promise<Job> => {
        try {
            const normalized = normalizeJob(await call());
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
            return normalized;
        } catch (err) {
            setError(err instanceof Error ? err.message : failMessage);
            throw err;
        }
    }, []);

    const assignVendor = useCallback((jobId: string, vendorId: string) =>
        mutateJob(jobId, () => jobService.assignVendor(jobId, vendorId), 'Failed to assign vendor')
            .then(() => undefined), [mutateJob]);

    const partialAssign = useCallback(async (
        jobId: string,
        vendorId: string,
        selectedItemIds: string[],
        selectedPhotoUrls: string[],
        manualDescription?: string,
        selectedServices: string[] = []
    ) => {
        const originalJob = jobsMap.get(jobId);
        if (!originalJob) {throw new Error('Original job not found');}

        const originalItems = originalJob.items || [];
        const originalServices = originalJob.services || [];

        // Determine if this is a "Full Swap" (selecting everything currently on the job)
        // or a "Partial Split" (taking a subset)
        const isSelectingAllItems = originalItems.length === 0 ||
            (selectedItemIds.length > 0 && originalItems.every(i => selectedItemIds.includes(i.id)));

        const isSelectingAllServices = originalServices.length === 0 ||
            (selectedServices.length > 0 && originalServices.every(s => selectedServices.includes(s)));

        const isFullReassign = isSelectingAllItems && isSelectingAllServices && originalJob.vendorId !== undefined;

        try {
            if (isFullReassign) {
                // 1. Just swap the vendor on the EXISTING job.
                // Use PartiallyAssigned so the new vendor does NOT see it yet — only
                // when the admin clicks "Mark Fully Assigned" does it flip to Assigned.
                const updatedJob = await jobService.updateJob(jobId, {
                    vendorId: vendorId,
                    status: JobStatus.PARTIALLY_ASSIGNED,
                    description: manualDescription || originalJob.description,
                    services: selectedServices.length > 0 ? selectedServices : originalJob.services,
                });
                const normalized = normalizeJob(updatedJob);
                setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
                setError(null);
                return;
            }

            // 2. Partial Split Logic (Creating a new sub-job).
            // Status is PartiallyAssigned — vendor cannot see it until admin finalises.
            const assignedItems = originalItems.filter(item => selectedItemIds.includes(item.id));

            const subJobData = {
                ...originalJob,
                id: undefined,
                jobNumber: undefined,
                vendorId: vendorId,
                status: JobStatus.PARTIALLY_ASSIGNED,
                services: selectedServices.length > 0 ? selectedServices : (isSelectingAllServices ? originalServices : []),
                description: manualDescription || (assignedItems.length > 0 ? assignedItems.map(i => i.description).join('\n') : originalJob.description),
                photos: selectedPhotoUrls.length > 0 ? selectedPhotoUrls : (originalJob.photos || []),
                parentJobId: jobId,
                customerId: originalJob.customerId,
                createdAt: new Date().toISOString(),
                notes: [],
            };

            const newJob = await jobService.createJob(subJobData);
            const normalizedNewJob = normalizeJob(newJob);

            // Update the ORIGINAL job:
            const updatedOriginalItems = originalItems.map(item =>
                selectedItemIds.includes(item.id) ? { ...item, isAssigned: true } : item
            );

            const remainingServices = originalServices.filter(s => !selectedServices.includes(s));

            const movedPhotoSet = new Set(selectedPhotoUrls);
            const remainingPhotos =
                selectedPhotoUrls.length > 0
                    ? (originalJob.photos || []).filter(url => !movedPhotoSet.has(url))
                    : undefined;

            const parentUpdate: Record<string, unknown> = {
                items: updatedOriginalItems,
                services: remainingServices,
            };
            if (remainingPhotos !== undefined) {
                parentUpdate.photos = remainingPhotos;
            }

            const updatedParent = await jobService.updateJob(jobId, parentUpdate);
            const normalizedParent = normalizeJob(updatedParent);
            // Keep split child on the parent for admin UI until the next full refresh (PUT may not return ChildJobs).
            const parentWithChildren: Job = {
                ...normalizedParent,
                childJobs: [...(normalizedParent.childJobs || []), normalizedNewJob],
            };

            setJobs(prevJobs => {
                const filtered = prevJobs.map(j => j.id === jobId ? parentWithChildren : j);
                return [normalizedNewJob, ...filtered];
            });
            setError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed assignment operation';
            setError(msg);
            // A partial split may have created the child but then failed the parent update,
            // leaving an orphaned child on the server. Resync from the server so the UI
            // reflects actual state instead of a half-applied local split.
            void refreshJobs();
            throw err;
        }
    }, [jobsMap, refreshJobs]);

    const finalizeAssignment = useCallback(async (jobId: string) => {
        const currentJob = jobsMap.get(jobId);
        if (!currentJob) {
            throw new Error('Job not found');
        }

        const hasRemainingServices = Array.isArray(currentJob.services) && currentJob.services.length > 0;
        const hasUnassignedItems = Array.isArray(currentJob.items) && currentJob.items.some(i => i && !i.isAssigned);
        if (hasRemainingServices || hasUnassignedItems) {
            throw new Error('You still need to assign the remaining job request items before marking fully assigned.');
        }

        try {
            // Try the atomic finalize endpoint first (backend promotes parent + all
            // PartiallyAssigned children to Assigned in a single transaction).
            let normalizedParent: Job;
            let normalizedChildren: Job[] = [];

            try {
                const result = await jobService.finalizeJob(jobId);
                normalizedParent = normalizeJob(result.parent);
                normalizedChildren = (result.children || []).map(normalizeJob);
            } catch (finalizeErr) {
                // Only fall back when the endpoint itself is missing (older backend). A bare
                // catch also swallowed auth/validation failures and silently ran the legacy
                // per-child promotion, hiding the real error from the admin.
                if (!isMissingEndpointError(finalizeErr)) {throw finalizeErr;}

                // Fallback: backend doesn't have the finalize endpoint yet.
                // Promote staging children individually then update the parent.
                const stagingChildren = jobs.filter(
                    j =>
                        j.parentJobId != null &&
                        String(j.parentJobId) === String(jobId) &&
                        j.status === JobStatus.PARTIALLY_ASSIGNED,
                );

                normalizedChildren = await Promise.all(
                    stagingChildren.map(child =>
                        jobService
                            .updateJob(child.id!, { status: JobStatus.ASSIGNED })
                            .then(normalizeJob),
                    ),
                );

                const parentUpdate =
                    currentJob.status === JobStatus.PARTIALLY_ASSIGNED
                        ? { status: JobStatus.ASSIGNED }
                        : { status: JobStatus.ASSIGNED };
                const updatedParent = await jobService.updateJob(jobId, parentUpdate);
                normalizedParent = normalizeJob(updatedParent);
            }

            // Merge all updated jobs into state at once.
            const updatedMap = new Map<string, Job>();
            updatedMap.set(normalizedParent.id!, normalizedParent);
            normalizedChildren.forEach(c => { if (c.id) {updatedMap.set(c.id, c);} });

            setJobs(prevJobs =>
                prevJobs.map(j => (j.id && updatedMap.has(j.id) ? updatedMap.get(j.id)! : j)),
            );
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to finalize assignment');
            throw err;
        }
    }, [jobsMap, jobs]);

    const unassignVendor = useCallback(async (jobId: string) => {
        const previous = jobsMap.get(jobId);
        try {
            const updatedJob = await jobService.unassignVendor(jobId);
            let normalized = normalizeJob(updatedJob);
            // Items / isAssigned are client-side splits; API does not return them — reset so assign UI works again.
            if (previous?.items?.length) {
                normalized = {
                    ...normalized,
                    items: previous.items.map(i => ({ ...i, isAssigned: false })),
                };
            }
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unassign vendor');
            throw err;
        }
    }, [jobsMap]);

    const unassignVendorScope = useCallback(async (parentJobId: string, vendorId: string) => {
        const snapshot = [...jobs];
        const childIdsToRemove = snapshot
            .filter(j => j.parentJobId === parentJobId && j.vendorId === vendorId)
            .map(j => j.id);
        const previousParent = snapshot.find(j => j.id === parentJobId);

        try {
            const updatedParent = await jobService.unassignVendorScope(parentJobId, vendorId);
            let normalizedParent = normalizeJob(updatedParent);
            if (previousParent?.items?.length) {
                // Item-level split state lives on client; put all items back as assignable when a vendor scope is removed.
                normalizedParent = {
                    ...normalizedParent,
                    items: previousParent.items.map(i => ({ ...i, isAssigned: false })),
                };
            }

            setJobs(prevJobs => {
                const withoutRemovedChildren = prevJobs.filter(j => !childIdsToRemove.includes(j.id));
                return withoutRemovedChildren.map(j => (j.id === parentJobId ? normalizedParent : j));
            });
            setError(null);
        } catch (err) {
            setJobs(snapshot);
            setError(err instanceof Error ? err.message : 'Failed to unassign vendor scope');
            throw err;
        }
    }, [jobs]);

    const acceptJob = useCallback((jobId: string) =>
        mutateJob(jobId, () => jobService.acceptJob(jobId), 'Failed to accept job')
            .then(() => undefined), [mutateJob]);

    const completeSale = useCallback((jobId: string, saleData: any) =>
        mutateJob(jobId, () => jobService.completeSale(jobId, saleData), 'Failed to complete sale')
            .then(() => undefined), [mutateJob]);

    const reachOut = useCallback((jobId: string) =>
        mutateJob(jobId, () => jobService.reachOut(jobId), 'Failed to reach out')
            .then(() => undefined), [mutateJob]);

    const setAppointment = useCallback((jobId: string) =>
        mutateJob(jobId, () => jobService.setAppointment(jobId), 'Failed to set appointment')
            .then(() => undefined), [mutateJob]);

    const completeJob = useCallback((jobId: string, photos?: string[]) =>
        mutateJob(jobId, () => jobService.completeJob(jobId, photos), 'Failed to complete job')
            .then(() => undefined), [mutateJob]);

    const requestInvoice = useCallback((jobId: string) =>
        mutateJob(jobId, () => jobService.requestInvoice(jobId), 'Failed to request invoice')
            .then(() => undefined), [mutateJob]);

    const uploadInvoice = useCallback((jobId: string, url: string) =>
        mutateJob(jobId, () => jobService.uploadInvoice(jobId, url), 'Failed to upload invoice')
            .then(() => undefined), [mutateJob]);

    // send-invoice does not mutate job state we cache; it just emails the customer.
    const sendInvoice = useCallback(async (jobId: string): Promise<string> => {
        const res = await jobService.sendInvoice(jobId);
        return res?.message ?? 'Invoice sent to customer.';
    }, []);

    const addJobPhotos = useCallback((jobId: string, photos: string[]) =>
        mutateJob(jobId, () => jobService.addJobPhotos(jobId, photos), 'Failed to add job photos')
            .then(() => undefined), [mutateJob]);

    const removeJobPhoto = useCallback((jobId: string, photoUrl: string) =>
        mutateJob(jobId, async () => {
            await jobService.removeJobPhoto(jobId, photoUrl);
            return jobService.getJobById(jobId);
        }, 'Failed to remove job photo')
            .then(() => undefined), [mutateJob]);

    // Debounced AsyncStorage persistence logic
    // This ensures that frequent updates (like photo uploads) don't lock the UI with repeated JSON serialization
    const lastSavedSignature = useRef<string | null>(null);
    useEffect(() => {
        // An empty list is persisted too — skipping it left ghost jobs in the cache that
        // reappeared on the next cold start. `isLoading` still gates the very first write so
        // the initial empty state can't clobber the cache before it has been read back.
        if (!user || isLoading) {return;}

        const timer = setTimeout(() => {
            // Signature comparison instead of stringifying the whole list on every change.
            const signature = jobsSignature(jobs);
            if (signature !== lastSavedSignature.current) {
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(jobs)).catch(() => { });
                lastSavedSignature.current = signature;
            }
        }, 800); // 800ms debounce

        return () => clearTimeout(timer);
    }, [jobs, user, isLoading]);

    const value = useMemo(() => ({
        jobs,
        addJob,
        updateJob,
        assignVendor,
        acceptJob,
        completeSale,
        reachOut,
        setAppointment,
        completeJob,
        requestInvoice,
        uploadInvoice,
        sendInvoice,
        addJobPhotos,
        removeJobPhoto,
        partialAssign,
        finalizeAssignment,
        unassignVendor,
        unassignVendorScope,
        getJobById,
        isLoading,
        refreshJobs,
        error,
    }), [jobs, addJob, updateJob, assignVendor, acceptJob, completeSale, reachOut, setAppointment, completeJob, requestInvoice, uploadInvoice, sendInvoice, addJobPhotos, getJobById, isLoading, refreshJobs, error, partialAssign, finalizeAssignment, unassignVendor, unassignVendorScope, removeJobPhoto]);

    return (
        <JobContext.Provider value={value}>
            {children}
        </JobContext.Provider>
    );
};

export const useJobs = () => {
    const context = useContext(JobContext);
    if (context === undefined) {
        throw new Error('useJobs must be used within a JobProvider');
    }
    return context;
};
