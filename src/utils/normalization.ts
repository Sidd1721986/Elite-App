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
        createdAt: user.createdAt || user.CreatedAt,
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
            jobNumber: 0,
            customerId: '',
            address: '',
            description: '',
            status: JobStatus.SUBMITTED,
            urgency: Urgency.NO_RUSH,
            photos: [],
            completedPhotos: [],   // was '' — must match string[] type so callers can safely call .map()
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
        jobNumber: Number(job.jobNumber ?? job.JobNumber ?? 0) || 0,
        customerId: job.customerId || job.CustomerId || '',
        vendorId: job.vendorId || job.VendorId,
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
        // Trim whitespace from each URL segment after splitting — the backend stores
        // comma-separated strings and some paths produce " http://..." with a leading
        // space, which breaks FastImage src loading.
        photos: typeof rawPhotos === 'string'
            ? rawPhotos.split(',').map(s => s.trim()).filter(Boolean)
            : (Array.isArray(rawPhotos) ? rawPhotos : []),
        completedPhotos: typeof rawCompletedPhotos === 'string'
            ? rawCompletedPhotos.split(',').map(s => s.trim()).filter(Boolean)
            : (Array.isArray(rawCompletedPhotos) ? rawCompletedPhotos : []),
        services: typeof (job.services || job.Services) === 'string'
            ? (job.services || job.Services).split(',').map((s: string) => s.trim()).filter(Boolean)
            : (Array.isArray(job.services || job.Services) ? (job.services || job.Services) : []),
        createdAt: job.createdAt || job.CreatedAt || new Date().toISOString(),
        notes: Array.isArray(job.notes || job.Notes) ? (job.notes || job.Notes) : [],
        parentJobId: (job.parentJobId || job.ParentJobId)?.toString(),
        jobSuffix: job.jobSuffix || job.JobSuffix,
        childJobs: Array.isArray(job.childJobs || job.ChildJobs)
            ? (job.childJobs || job.ChildJobs).map((c: any) => normalizeJob(c))
            : [],
        ...(Array.isArray(job.items || job.Items) ? { items: job.items || job.Items } : {}),
    } as Job;
};
