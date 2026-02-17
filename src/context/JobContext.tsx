import * as React from 'react';
import { createContext, useState, useContext, useEffect } from 'react';
import { Job, JobStatus, Contact, Urgency } from '../types/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface JobContextType {
    jobs: Job[];
    addJob: (jobData: Omit<Job, 'id' | 'status' | 'createdAt'>) => Promise<void>;
    updateJob: (jobId: string, updates: Partial<Job>) => Promise<void>;
    getJobById: (jobId: string) => Job | undefined;
    isLoading: boolean;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

const STORAGE_KEY = '@jobs';

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadJobs();
    }, []);

    const loadJobs = async () => {
        try {
            const storedJobs = await AsyncStorage.getItem(STORAGE_KEY);
            if (storedJobs) {
                setJobs(JSON.parse(storedJobs));
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const saveJobs = async (updatedJobs: Job[]) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedJobs));
            setJobs(updatedJobs);
        } catch (error) {
            console.error('Error saving jobs:', error);
        }
    };

    const addJob = async (jobData: Omit<Job, 'id' | 'status' | 'createdAt'>) => {
        const newJob: Job = {
            ...jobData,
            id: Math.random().toString(36).substr(2, 9),
            status: JobStatus.SUBMITTED,
            createdAt: new Date().toISOString(),
        };
        await saveJobs([newJob, ...jobs]);
    };

    const updateJob = async (jobId: string, updates: Partial<Job>) => {
        const updatedJobs = jobs.map(job =>
            job.id === jobId ? { ...job, ...updates } : job
        );
        await saveJobs(updatedJobs);
    };

    const getJobById = (jobId: string) => {
        return jobs.find(job => job.id === jobId);
    };

    return (
        <JobContext.Provider value={{ jobs, addJob, updateJob, getJobById, isLoading }}>
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
