import { normalizeJob } from '../normalization';

describe('normalizeJob', () => {
    it('should correctly normalize dimensions field from API', () => {
        const rawJob = {
            id: 'job-123',
            jobNumber: 42,
            address: '123 Main St',
            description: 'Roofing repair',
            services: 'Roofing',
            dimensions: '30ft x 40ft (approx 2,400 sq ft)',
        };

        const job = normalizeJob(rawJob);
        expect(job.dimensions).toBe('30ft x 40ft (approx 2,400 sq ft)');
        expect(job.services).toEqual(['Roofing']);
    });

    it('should handle PascalCase Dimensions from C# backend', () => {
        const rawJob = {
            Id: 'job-456',
            JobNumber: 99,
            Address: '456 Oak St',
            Description: 'Windows / doors replacement',
            Services: 'Windows / doors',
            Dimensions: '36" x 80" front door, 4 windows 36" x 60"',
        };

        const job = normalizeJob(rawJob);
        expect(job.dimensions).toBe('36" x 80" front door, 4 windows 36" x 60"');
    });

    it('should handle undefined dimensions cleanly', () => {
        const rawJob = {
            id: 'job-789',
            jobNumber: 100,
            address: '789 Pine St',
            description: 'Electrical repair',
        };

        const job = normalizeJob(rawJob);
        expect(job.dimensions).toBeUndefined();
    });
});
