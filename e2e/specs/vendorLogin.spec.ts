import { device, element, by, expect as detoxExpect, waitFor } from 'detox';

const VENDOR_EMAIL    = process.env.TEST_VENDOR_EMAIL    ?? '';
const VENDOR_PASSWORD = process.env.TEST_VENDOR_PASSWORD ?? '';

describe('Vendor login flow', () => {
    beforeAll(async () => {
        await device.launchApp({ newInstance: true });
    });

    afterAll(async () => {
        await device.terminateApp();
    });

    it('taps the Vendor role button on Landing', async () => {
        await waitFor(element(by.id('role_btn_vendor')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('role_btn_vendor')).tap();
    });

    it('fills in vendor credentials', async () => {
        await waitFor(element(by.id('login_email_input')))
            .toBeVisible()
            .withTimeout(10_000);
        await element(by.id('login_email_input')).clearText();
        await element(by.id('login_email_input')).typeText(VENDOR_EMAIL);

        await element(by.id('login_password_input')).clearText();
        await element(by.id('login_password_input')).typeText(VENDOR_PASSWORD);
    });

    it('taps Log In and lands on Vendor Dashboard', async () => {
        await element(by.id('login_submit_btn')).tap();

        await waitFor(element(by.id('vendor_dashboard_screen')))
            .toBeVisible()
            .withTimeout(15_000);

        await detoxExpect(element(by.id('vendor_dashboard_screen'))).toBeVisible();
    });
});
