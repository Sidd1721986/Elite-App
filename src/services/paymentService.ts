import { apiClient } from './apiClient';

export const paymentService = {
    /**
     * Starts a hosted Stripe Checkout for a job and returns the Stripe-hosted URL.
     * The app opens this URL so the customer pays on Stripe's own page. The job flips to
     * 'Paid' via the checkout.session.completed webhook — never from the client.
     */
    async createCheckout(jobId: string): Promise<{ url: string }> {
        return apiClient.post<{ url: string }>(`/payments/jobs/${jobId}/checkout`, {});
    },
};
