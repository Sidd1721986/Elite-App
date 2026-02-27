import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { JobProvider, useJobs } from '../JobContext';
import { jobService } from '../../services/jobService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { InteractionManager } from 'react-native';

jest.mock('../../services/jobService');
jest.mock('../../utils/normalization', () => ({
    normalizeJob: (job: any) => job,
}));

// Mock InteractionManager to run immediately
jest.mock('react-native/Libraries/Interaction/InteractionManager', () => ({
    runAfterInteractions: (callback: () => void) => callback(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <JobProvider>{children}</JobProvider>
);

describe('JobContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should load jobs from AsyncStorage then from API', async () => {
        const cachedJobs = [{ id: '1', title: 'Cached Job' }];
        const remoteJobs = [{ id: '2', title: 'Remote Job' }];

        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedJobs));
        (jobService.getJobs as jest.Mock).mockResolvedValueOnce(remoteJobs);

        const { result } = renderHook(() => useJobs(), { wrapper });

        // Wait for async loadJobs
        await act(async () => { });

        expect(result.current.jobs).toEqual(remoteJobs);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@jobs_cache', JSON.stringify(remoteJobs));
    });

    it('addJob should update state and call jobService', async () => {
        (jobService.getJobs as jest.Mock).mockResolvedValueOnce([]);
        const newJob = { id: '3', title: 'New Job' };
        (jobService.createJob as jest.Mock).mockResolvedValueOnce(newJob);

        const { result } = renderHook(() => useJobs(), { wrapper });
        await act(async () => { });

        await act(async () => {
            await result.current.addJob({ title: 'New Job' });
        });

        expect(result.current.jobs).toContainEqual(newJob);
    });
});
