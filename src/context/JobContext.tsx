import * as React from 'react';
import { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { Job, JobStatus, User } from '../types/types';
import { jobService } from '../services/jobService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

const STORAGE_KEY = '@jobs_cache';

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

    const jobsMap = useMemo(() => {
        const map = new Map<string, Job>();
        jobs.forEach(job => {
            if (job && job.id) map.set(job.id, job);
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

        // Priority 2: Fetch from API after animations complete (avoid jank)
        InteractionManager.runAfterInteractions(async () => {
            try {
                const remoteJobs = await jobService.getJobs();
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
                        if (!j?.id || seen.has(String(j.id))) return;
                        seen.add(String(j.id));
                        flat.push(j);
                        // Recurse into nested children
                        if (Array.isArray(j.childJobs)) {
                            j.childJobs.forEach((c: any) => enqueue(c));
                        }
                    };
                    jobsArray.forEach(enqueue);

                    const normalized = flat.map(normalizeJob);
                    setJobs(normalized);
                    setError(null);
                }
            } catch (err) {
                if (isMounted.current) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    if (__DEV__ && !errorMsg.includes('401') && !errorMsg.toLowerCase().includes('unauthorized')) {
                        console.error('Error loading jobs:', err);
                    }
                }
            } finally {
                if (isMounted.current) {
                    setIsLoading(false);
                }
            }
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
        let snapshot: Job[] = [];

        setJobs(prevJobs => {
            snapshot = [...prevJobs]; // Proper clone
            return prevJobs.map(job =>
                job.id === jobId ? { ...job, ...updates } : job
            );
        });

        try {
            const updatedJob = await jobService.updateJob(jobId, updates);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(job =>
                job.id === jobId ? normalized : job
            ));
            setError(null);
        } catch (err: any) {
            const msg = err?.message || 'Failed to update job';
            if (__DEV__) console.error('JobContext: Update failed:', msg);
            // Revert to snapshot
            setJobs(snapshot);
            setError(msg);
            throw err;
        }
    }, []); // Removed jobs from dependency array to prevent stale closure issues with snapshot

    const assignVendor = useCallback(async (jobId: string, vendorId: string) => {
        try {
            const updatedJob = await jobService.assignVendor(jobId, vendorId);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to assign vendor');
            throw err;
        }
    }, []);

    const partialAssign = useCallback(async (
        jobId: string, 
        vendorId: string, 
        selectedItemIds: string[], 
        selectedPhotoUrls: string[], 
        manualDescription?: string,
        selectedServices: string[] = []
    ) => {
        const originalJob = jobsMap.get(jobId);
        if (!originalJob) throw new Error('Original job not found');

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
                    services: selectedServices.length > 0 ? selectedServices : originalJob.services
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
            throw err;
        }
    }, [jobsMap]);

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
            } catch {
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
            normalizedChildren.forEach(c => { if (c.id) updatedMap.set(c.id, c); });

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

    const acceptJob = useCallback(async (jobId: string) => {
        try {
            const updatedJob = await jobService.acceptJob(jobId);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to accept job');
            throw err;
        }
    }, []);

    const completeSale = useCallback(async (jobId: string, saleData: any) => {
        try {
            const updatedJob = await jobService.completeSale(jobId, saleData);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete sale');
            throw err;
        }
    }, []);

    const reachOut = useCallback(async (jobId: string) => {
        try {
            const updatedJob = await jobService.reachOut(jobId);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reach out');
            throw err;
        }
    }, []);

    const setAppointment = useCallback(async (jobId: string) => {
        try {
            const updatedJob = await jobService.setAppointment(jobId);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to set appointment');
            throw err;
        }
    }, []);

    const completeJob = useCallback(async (jobId: string, photos?: string[]) => {
        try {
            const updatedJob = await jobService.completeJob(jobId, photos);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to complete job');
            throw err;
        }
    }, []);

    const requestInvoice = useCallback(async (jobId: string) => {
        try {
            const updatedJob = await jobService.requestInvoice(jobId);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to request invoice');
            throw err;
        }
    }, []);

    const uploadInvoice = useCallback(async (jobId: string, url: string) => {
        try {
            const updatedJob = await jobService.uploadInvoice(jobId, url);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload invoice');
            throw err;
        }
    }, []);

    const addJobPhotos = useCallback(async (jobId: string, photos: string[]) => {
        try {
            const updatedJob = await jobService.addJobPhotos(jobId, photos);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add job photos');
            throw err;
        }
    }, []);

    const removeJobPhoto = useCallback(async (jobId: string, photoUrl: string) => {
        try {
            await jobService.removeJobPhoto(jobId, photoUrl);
            const updatedJob = await jobService.getJobById(jobId);
            const normalized = normalizeJob(updatedJob);
            setJobs(prevJobs => prevJobs.map(j => j.id === jobId ? normalized : j));
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove job photo');
            throw err;
        }
    }, [refreshJobs]);

    // Debounced AsyncStorage persistence logic
    // This ensures that frequent updates (like photo uploads) don't lock the UI with repeated JSON serialization
    const lastSavedString = useRef<string>('');
    useEffect(() => {
        if (!user || jobs.length === 0) return;

        const timer = setTimeout(() => {
            const jobsString = JSON.stringify(jobs);
            // Only write if content actually changed to avoid redundant disk I/O
            if (jobsString !== lastSavedString.current) {
                AsyncStorage.setItem(STORAGE_KEY, jobsString).catch(() => { });
                lastSavedString.current = jobsString;
            }
        }, 800); // 800ms debounce

        return () => clearTimeout(timer);
    }, [jobs, user]);

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
        addJobPhotos,
        removeJobPhoto,
        partialAssign,
        finalizeAssignment,
        unassignVendor,
        unassignVendorScope,
        getJobById,
        isLoading,
        refreshJobs,
        error
    }), [jobs, addJob, updateJob, assignVendor, acceptJob, completeSale, reachOut, setAppointment, completeJob, requestInvoice, uploadInvoice, addJobPhotos, getJobById, isLoading, refreshJobs, error, partialAssign, finalizeAssignment, unassignVendor, unassignVendorScope, removeJobPhoto]);

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
