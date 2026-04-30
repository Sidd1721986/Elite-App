import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

const USER_EMAIL    = process.env.TEST_USER_EMAIL    ?? '';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? '';

describe('User — request a service job', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    afterAll(async () => {
        await device.terminateApp();
    });

    it('taps the User role button on Landing', async () => {
        await waitFor(element(by.id('role_btn_user')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('role_btn_user')).tap();
    });

    it('logs in as a user', async () => {
        await waitFor(element(by.id('login_email_input')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('login_email_input')).clearText();
        await element(by.id('login_email_input')).typeText(USER_EMAIL);

        await element(by.id('login_password_input')).clearText();
        await element(by.id('login_password_input')).typeText(USER_PASSWORD);
        await element(by.id('login_submit_btn')).tap();

        await waitFor(element(by.id('user_dashboard_screen')))
            .toBeVisible()
            .withTimeout(15_000);
    });

    it('opens the Request Service modal', async () => {
        await waitFor(element(by.id('request_service_btn')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('request_service_btn')).tap();

        // The modal should appear
        await waitFor(element(by.id('job_street_input')))
            .toBeVisible()
            .withTimeout(8_000);
    });

    it('fills in the service address and contact phone', async () => {
        await element(by.id('job_street_input')).clearText();
        await element(by.id('job_street_input')).typeText('123 Test St');

        // City and Zip — found by label since they share no testID yet
        await element(by.label('City *')).clearText();
        await element(by.label('City *')).typeText('Dallas');

        await element(by.label('Zip *')).clearText();
        await element(by.label('Zip *')).typeText('75201');

        await waitFor(element(by.id('job_phone_input')))
            .toBeVisible()
            .withTimeout(5_000);
        await element(by.id('job_phone_input')).clearText();
        await element(by.id('job_phone_input')).typeText('2145551234');
    });

    it('selects a service and submits the job request', async () => {
        // Tap the first available service chip (scrolling if needed)
        try {
            await element(by.text('Plumbing')).tap();
        } catch {
            await element(by.text('Electrical')).tap();
        }

        // Tap Submit
        await waitFor(element(by.id('job_submit_btn')))
            .toBeVisible()
            .withTimeout(5_000);
        await element(by.id('job_submit_btn')).tap();

        // Confirm success toast
        await waitFor(element(by.text('Job request submitted successfully!')))
            .toBeVisible()
            .withTimeout(10_000);
    });
});
