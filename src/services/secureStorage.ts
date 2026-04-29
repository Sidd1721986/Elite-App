import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * SecureStorage provides a unified API for storing sensitive data.
 * It uses react-native-keychain for tokens and fallbacks to AsyncStorage
 * for non-sensitive data or when Keychain is unavailable.
 */
export const SecureStorage = {
    /**
     * Stores a sensitive string (like a JWT) securely.
     */
    async setItem(key: string, value: string): Promise<boolean> {
        try {
            if (value === null || value === undefined) {
                await this.removeItem(key);
                return true;
            }

            // Use Keychain for specific sensitive keys
            if (key === 'auth_token' || key === 'jwt_token') {
                await Keychain.setGenericPassword(key, value, {
                    service: key,
                    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
                });
                return true;
            }

            // Fallback for other data
            await AsyncStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error('SecureStorage: Error setting item', error);
            return false;
        }
    },

    /**
     * Retrieves a string from secure storage.
     */
    async getItem(key: string): Promise<string | null> {
        try {
            if (key === 'auth_token' || key === 'jwt_token') {
                const credentials = await Keychain.getGenericPassword({ service: key });
                if (credentials) {
                    return credentials.password;
                }
                // Migration fallback: token was stored in AsyncStorage before Keychain was introduced.
                // Warn so we know when this path is hit; it should become unreachable after one login cycle.
                const legacy = await AsyncStorage.getItem(key);
                if (legacy) {
                    console.warn(`SecureStorage: token "${key}" found only in AsyncStorage (unencrypted). ` +
                        'User should re-login so the token is migrated to Keychain.');
                }
                return legacy;
            }

            return await AsyncStorage.getItem(key);
        } catch (error) {
            console.error('SecureStorage: Error getting item', error);
            return null;
        }
    },

    /**
     * Removes an item from storage.
     */
    async removeItem(key: string): Promise<boolean> {
        try {
            if (key === 'auth_token' || key === 'jwt_token') {
                await Keychain.resetGenericPassword({ service: key });
            }
            await AsyncStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('SecureStorage: Error removing item', error);
            return false;
        }
    },
};
