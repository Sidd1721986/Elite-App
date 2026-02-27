import { jobService } from '../jobService';
import { apiClient } from '../apiClient';

jest.mock('../apiClient');

describe('jobService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('getJobs should call apiClient.get(/jobs)', async () => {
        await jobService.getJobs();
        expect(apiClient.get).toHaveBeenCalledWith('/jobs');
    });

    it('getJobById should call apiClient.get(/jobs/:id)', async () => {
        await jobService.getJobById('123');
        expect(apiClient.get).toHaveBeenCalledWith('/jobs/123');
    });

    it('createJob should call apiClient.post(/jobs, data)', async () => {
        const data = { title: 'New Job' };
        await jobService.createJob(data);
        expect(apiClient.post).toHaveBeenCalledWith('/jobs', data);
    });

    it('updateJob should call apiClient.put(/jobs/:id, data)', async () => {
        const data = { title: 'Updated Job' };
        await jobService.updateJob('123', data);
        expect(apiClient.put).toHaveBeenCalledWith('/jobs/123', data);
    });

    it('assignVendor should call correct endpoint', async () => {
        await jobService.assignVendor('job1', 'vendor1');
        expect(apiClient.post).toHaveBeenCalledWith('/jobs/job1/assign', { vendorId: 'vendor1' });
    });

    it('acceptJob should call correct endpoint', async () => {
        await jobService.acceptJob('job1');
        expect(apiClient.post).toHaveBeenCalledWith('/jobs/job1/accept', {});
    });

    it('addNote should call correct endpoint', async () => {
        await jobService.addNote('job1', 'some note');
        expect(apiClient.post).toHaveBeenCalledWith('/jobs/job1/notes', { content: 'some note' });
    });

    it('getNotes should call correct endpoint', async () => {
        await jobService.getNotes('job1');
        expect(apiClient.get).toHaveBeenCalledWith('/jobs/job1/notes');
    });

    it('completeSale should call correct endpoint', async () => {
        const saleData = { scopeOfWork: 'Test', contractAmount: 100, workStartDate: '2023-01-01' };
        await jobService.completeSale('job1', saleData);
        expect(apiClient.post).toHaveBeenCalledWith('/jobs/job1/complete-sale', saleData);
    });
});
