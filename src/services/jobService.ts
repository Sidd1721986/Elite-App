import { apiClient } from './apiClient';
import { Job } from '../types/types';

export const jobService = {
    /** @param fresh bypass the 5-min GET cache — explicit refreshes and polls must see
     *  server truth (e.g. a job the admin just assigned, or Paid status after checkout). */
    async getJobs(fresh = false): Promise<Job[]> {
        return apiClient.get<Job[]>('/jobs', fresh);
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

    async unassignVendor(jobId: string): Promise<Job> {
        // Use PUT /jobs/{id} so deployments that only expose standard CRUD still work (POST .../unassign-vendor 404s on older builds).
        return apiClient.put<Job>(`/jobs/${jobId}`, { clearAssignedVendor: true });
    },

    async unassignVendorScope(parentJobId: string, vendorId: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${parentJobId}/unassign-scope-vendor`, { vendorId });
    },

    /**
     * Atomically promotes the parent job and all of its PartiallyAssigned children
     * to 'Assigned', making them visible to vendors for the first time.
     * Backend: POST /jobs/{id}/finalize
     * Expected response: { parent: Job; children: Job[] }
     */
    async finalizeJob(jobId: string): Promise<{ parent: Job; children: Job[] }> {
        return apiClient.post<{ parent: Job; children: Job[] }>(`/jobs/${jobId}/finalize`, {});
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
    },

    async reachOut(jobId: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/reach-out`, {});
    },

    async setAppointment(jobId: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/set-appointment`, {});
    },

    async completeJob(jobId: string, completedPhotos?: string[]): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/complete`, { completedPhotos });
    },

    async requestInvoice(jobId: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/request-invoice`, {});
    },

    async uploadInvoice(jobId: string, invoiceDocumentUrl: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/upload-invoice`, { invoiceDocumentUrl });
    },

    /** Admin emails the uploaded invoice to the customer. */
    async sendInvoice(jobId: string): Promise<{ message: string }> {
        return apiClient.post<{ message: string }>(`/jobs/${jobId}/send-invoice`, {});
    },
    async addJobPhotos(jobId: string, photos: string[]): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/photos`, { photos });
    },
    async removeJobPhoto(jobId: string, photoUrl: string): Promise<Job> {
        return apiClient.post<Job>(`/jobs/${jobId}/photos/remove`, { photoUrl });
    },
    async uploadFile(file: any): Promise<{ url: string }> {
        const formData = new FormData();
        formData.append('file', file);
        // Do NOT set Content-Type manually: a bare 'multipart/form-data' has no boundary
        // parameter, so the server can't parse the body. Let React Native's fetch generate
        // the header (with the correct boundary) from the FormData body.
        return apiClient.request<{ url: string }>('/files/upload', {
            method: 'POST',
            body: formData,
        });
    },
};
