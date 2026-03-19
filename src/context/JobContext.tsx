import * as React from 'react';
import { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { Job, User } from '../types/types';
import { jobService } from '../services/jobService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

const STORAGE_KEY = '@jobs_cache';

import { normalizeUser, normalizeJob } from '../utils/normalization';
import { useAuth } from './AuthContext';

// Ensure each user only sees their own jobs (except Admins who see all)
const scopeJobsToUser = (jobs: Job[], user: User | null): Job[] => {
    if (!user) return jobs;

    const role = (user.role || '').toString();
    if (role.toLowerCase() === 'admin') {
        return jobs;
    }

    // Vendors: jobs assigned to this vendor
    if (role.toLowerCase() === 'vendor') {
        return jobs.filter(job => {
            const vendorId = (job.vendorId || job.vendor?.id || '').toString();
            return vendorId && user.id && vendorId === user.id.toString();
        });
    }

    // Customers (and other non-admin roles): jobs created by this customer
    return jobs.filter(job => {
        const customerId = (job.customerId || job.customer?.id || '').toString();
        return customerId && user.id && customerId === user.id.toString();
    });
};

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
                    const scoped = scopeJobsToUser(normalized, user);
                    setJobs(scoped);
                    setIsLoading(false);
                }
            } catch {
                // Ignore cache read errors
            }
        }

        // Priority 2: Fetch from API after animations complete (avoid jank)
        InteractionManager.runAfterInteractions(async () => {
            try {
                const remoteJobs = await jobService.getJobs();
                if (isMounted.current) {
                    const jobsArray = Array.isArray(remoteJobs) ? remoteJobs : (remoteJobs && typeof remoteJobs === 'object' ? [remoteJobs] : []);
                    const normalized = jobsArray.map(normalizeJob);
                    const scoped = scopeJobsToUser(normalized, user);
                    setJobs(scoped);
                    setError(null);
                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(scoped)).catch(() => { });
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
            setJobs(prevJobs => {
                const updated = [normalized, ...prevJobs];
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => { });
                return updated;
            });
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
            setJobs(prevJobs => {
                const updated = prevJobs.map(job =>
                    job.id === jobId ? normalized : job
                );
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(() => { });
                return updated;
            });
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

    // Memoize job lookup with a Map for O(1) access
    const jobsMap = useMemo(() => {
        const map = new Map<string, Job>();
        jobs.forEach(job => map.set(job.id, job));
        return map;
    }, [jobs]);

    const getJobById = useCallback((jobId: string) => {
        return jobsMap.get(jobId);
    }, [jobsMap]);

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
        getJobById,
        isLoading,
        refreshJobs,
        error
    }), [jobs, addJob, updateJob, assignVendor, acceptJob, completeSale, reachOut, setAppointment, completeJob, getJobById, isLoading, refreshJobs, error]);

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
