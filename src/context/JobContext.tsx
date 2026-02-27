import * as React from 'react';
import { createContext, useState, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { Job, User } from '../types/types';
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
            console.log('JobContext: Skipping job load (no user logged in)');
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
                    setJobs(normalized);
                    setError(null);
                    // Cache normalized data
                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)).catch(() => { });
                }
            } catch (err) {
                if (isMounted.current) {
                    setError(err instanceof Error ? err.message : 'Failed to load jobs');
                    console.error('Error loading jobs:', err);
                }
            } finally {
                if (isMounted.current) {
                    setIsLoading(false);
                }
            }
        });
    }, []);

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
            console.error('JobContext: Update failed:', msg);
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
        getJobById,
        isLoading,
        refreshJobs,
        error
    }), [jobs, addJob, updateJob, assignVendor, acceptJob, completeSale, getJobById, isLoading, refreshJobs, error]);

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
