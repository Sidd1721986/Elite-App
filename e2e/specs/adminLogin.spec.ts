import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? '';

describe('Admin login flow', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    afterAll(async () => {
        await device.terminateApp();
    });

    it('taps the Admin role button on Landing', async () => {
        await waitFor(element(by.id('role_btn_admin')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('role_btn_admin')).tap();
    });

    it('fills in admin credentials', async () => {
        await waitFor(element(by.id('login_email_input')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('login_email_input')).clearText();
        await element(by.id('login_email_input')).typeText(ADMIN_EMAIL);

        await element(by.id('login_password_input')).clearText();
        await element(by.id('login_password_input')).typeText(ADMIN_PASSWORD);
    });

    it('taps Log In and lands on Admin Dashboard', async () => {
        await element(by.id('login_submit_btn')).tap();

        // Wait up to 15 s for the dashboard to appear (network round-trip)
        await waitFor(element(by.id('admin_dashboard_screen')))
            .toBeVisible()
            .withTimeout(15_000);

        await detoxExpect(element(by.id('admin_dashboard_screen'))).toBeVisible();
    });
});
