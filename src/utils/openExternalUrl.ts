import { Alert, Linking } from 'react-native';

/**
 * Opens HTTPS (or mailto) URLs for legal/support pages. Shows a simple alert on failure.
 */
export async function openExternalUrl(url: string): Promise<void> {
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
