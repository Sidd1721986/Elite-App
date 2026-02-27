import { apiClient } from './apiClient';
import { Job } from '../types/types';

export const jobService = {
    async getJobs(): Promise<Job[]> {
        return apiClient.get<Job[]>('/jobs');
    },

    async getJobById(id: string): Promise<Job> {
        return apiClient.get<Job>(`/jobs/${id}`);
    },

    async createJob(jobData: any): Promise<Job> {
        return apiClient.post<Job>('/jobs', jobData);
    },

    async updateJob(id: string, updates: any): Promise<Job> {
        return apiClient.put<Job>(`/jobs/${id}`, updates);
    },

    async assignVendor(jobId: string, vendorId: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/assign`, { vendorId });
    },

    async acceptJob(jobId: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/accept`, {});
    },

    async addNote(jobId: string, content: string): Promise<any> {
        return apiClient.post(`/jobs/${jobId}/notes`, { content });
    },

    async getNotes(jobId: string): Promise<any[]> {
        return apiClient.get(`/jobs/${jobId}/notes`);
    },

    async completeSale(jobId: string, saleData: { scopeOfWork: string; contractAmount: number; workStartDate: string }): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/complete-sale`, saleData);
    }
};
