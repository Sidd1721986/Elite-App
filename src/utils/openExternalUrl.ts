import { Alert, Linking } from 'react-native';

/**
 * Opens HTTPS (or mailto) URLs for legal/support pages. Shows a simple alert on failure.
 */
export async function openExternalUrl(url: string): Promise<void> {
    // Allow only safe schemes. Server- or peer-controlled URLs (invoice links, chat URLs)
    // must never be able to fire tel:/sms:/custom-app schemes via Linking.
    if (!/^(https?:\/\/|mailto:)/i.test((url || '').trim())) {
        Alert.alert('Unable to open', 'This link type is not supported.');
        return;
    }
    try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) {
            Alert.alert('Unable to open', 'This link cannot be opened on your device.');
            return;
        }
        await Linking.openURL(url);
    } catch {
        Alert.alert('Unable to open', 'Something went wrong opening the link.');
    }
}
