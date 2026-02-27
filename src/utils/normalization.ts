import { User, Job, Contact, JobNote, JobStatus, Urgency } from '../types/types';

/**
 * Robustly normalizes user data from raw API response.
 * Handles casing differences and ensures required string properties exist.
 */
export const normalizeUser = (user: any): User | undefined => {
    if (!user || typeof user !== 'object' || Object.keys(user).length === 0) return undefined;

    return {
        ...user,
        id: (user.id || user.Id)?.toString() || '',
        name: user.name || user.Name || '',
        email: user.email || user.Email || '',
        phone: user.phone || user.Phone || '',
        role: user.role || user.Role,
        address: user.address || user.Address || '',
    };
};

/**
 * Robustly normalizes job data from raw API response.
 * Guarantees arrays for photos and contacts, and safe defaults for status/urgency.
 */
export const normalizeJob = (job: any): Job => {
    if (!job || typeof job !== 'object') {
        return {
            id: '',
            customerId: '',
            address: '',
            description: '',
            status: JobStatus.SUBMITTED,
            urgency: Urgency.NO_RUSH,
            photos: [],
            completedPhotos: '',
            contacts: [],
            createdAt: new Date().toISOString()
        } as Job;
    }

    const rawPhotos = job.photos || job.Photos || [];
    const rawCompletedPhotos = job.completedPhotos || job.CompletedPhotos || '';
    const rawContacts = job.contacts || job.Contacts || [];

    return {
        ...job,
        id: (job.id || job.Id)?.toString() || '',
        customerId: job.customerId || job.CustomerId || '',
        address: job.address || job.Address || '',
        description: job.description || job.Description || '',
        status: job.status || job.Status || JobStatus.SUBMITTED,
        urgency: job.urgency || job.Urgency || Urgency.NO_RUSH,
        otherDetails: job.otherDetails || job.OtherDetails,
        contactPhone: job.contactPhone || job.ContactPhone,
        contactEmail: job.contactEmail || job.ContactEmail,
        contacts: Array.isArray(rawContacts) ? rawContacts : [],
        customer: normalizeUser(job.customer || job.Customer),
        vendor: normalizeUser(job.vendor || job.Vendor),
        photos: typeof rawPhotos === 'string' ? rawPhotos.split(',').filter(Boolean) : (Array.isArray(rawPhotos) ? rawPhotos : []),
        completedPhotos: typeof rawCompletedPhotos === 'string' ? rawCompletedPhotos : (Array.isArray(rawCompletedPhotos) ? rawCompletedPhotos.join(',') : ''),
        createdAt: job.createdAt || job.CreatedAt || new Date().toISOString(),
        notes: Array.isArray(job.notes || job.Notes) ? (job.notes || job.Notes) : [],
    } as Job;
};
