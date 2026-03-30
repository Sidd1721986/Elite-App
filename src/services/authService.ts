import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types/types';
import { apiClient, setApiClientAuthToken } from './apiClient';

const USERS_KEY = '@users';

/** Login/signup: maps UI role to backend account type (Admin, Vendor, or Customer only). */
export function toApiRole(role: UserRole): 'Admin' | 'Vendor' | 'Customer' {
    if (role === UserRole.ADMIN) return 'Admin';
    if (role === UserRole.VENDOR) return 'Vendor';
    return 'Customer';
}

export const authService = {
    // Register a new user
    async signup(
        name: string,
        email: string,
        password: string,
        role: UserRole, // This will be the granular role from UI
        address: string,
        phone: string,
        referralSource: string,
        roleOther?: string
    ): Promise<boolean | string> {
        try {
            // Map granular roles to the 3 main roles expected by the backend
            let apiRole = 'Customer';
            if (role === UserRole.ADMIN) apiRole = 'Admin';
            else if (role === UserRole.VENDOR) apiRole = 'Vendor';

            await apiClient.post('/auth/register', {
                name,
                email,
                password,
                role: apiRole,
                address,
                phone
                // referralSource and roleOther might need addition to backend if needed
            });
            return true;
        } catch (error: any) {
            console.error('Error signing up:', error);
            const msg = (error?.message || '').toString();
            if (/network request failed|failed to fetch|timed out|network error/i.test(msg)) {
                return 'Cannot reach the API. Start the backend (cd backend && dotnet run, port 5260). On a physical phone, set DEV_API_HOST in src/config/appConfig.ts to your computer\'s Wi‑Fi IP.';
            }
            return msg || 'Signup failed';
        }
    },

    // Login user
    async login(email: string, password: string, role: UserRole): Promise<User | null> {
        try {
            let apiRole = 'Customer';
            if (role === UserRole.ADMIN) apiRole = 'Admin';
            else if (role === UserRole.VENDOR) apiRole = 'Vendor';

            const response = await apiClient.post<{ token?: string; user?: any }>('/auth/login', {
                email: email.trim(),
                password,
                role: apiRole,
            });

            const token = response.token ?? (response as any).accessToken ?? (response as any).Token;
            const userPayload = response.user ?? (response as any).User;
            if (token && userPayload) {
                await AsyncStorage.setItem('@auth_token', token);
                setApiClientAuthToken(token);
                await AsyncStorage.setItem('@current_user', JSON.stringify(userPayload));
                return userPayload as User;
            }

            return null;
        } catch (error: any) {
            console.error('Error logging in:', error);
            throw error; // Rethrow to let UI handle error message
        }
    },

    // Get current logged in user
    async getCurrentUser(): Promise<User | null> {
        try {
            const userJson = await AsyncStorage.getItem('@current_user');
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    // Logout user
    async logout(): Promise<void> {
        try {
            await AsyncStorage.removeItem('@auth_token');
            await AsyncStorage.removeItem('@current_user');
            setApiClientAuthToken(null);
        } catch (error) {
            console.error('Error logging out:', error);
        }
    },

    // Get users pending vendor approval (bypass cache so token is always sent)
    async getPendingVendors(): Promise<User[]> {
        try {
            return await apiClient.get<User[]>('/users/pending-vendors', true);
        } catch (error) {
            if (__DEV__) console.error('Error getting pending vendors:', error);
            return [];
        }
    },

    // Approve or deny a vendor
    async updateUserStatus(userId: string, approved: boolean): Promise<boolean> {
        try {
            if (approved) {
                await apiClient.post(`/users/approve-vendor/${userId}`, {});
            } else {
                await apiClient.post(`/users/deny-vendor/${userId}`, {});
            }
            return true;
        } catch (error) {
            console.error('Error updating user status:', error);
            return false;
        }
    },

    // Get users who are approved vendors (bypass cache so token is always sent)
    async getApprovedVendors(): Promise<User[]> {
        try {
            return await apiClient.get<User[]>('/users/approved-vendors', true);
        } catch (error) {
            if (__DEV__) console.error('Error getting approved vendors:', error);
            return [];
        }
    },

    // Remove a vendor
    async removeVendor(userId: string): Promise<boolean> {
        try {
            await apiClient.delete(`/users/remove-vendor/${userId}`);
            return true;
        } catch (error) {
            console.error('Error removing vendor:', error);
            return false;
        }
    },

    async forgotPasswordEligibility(email: string, role: UserRole): Promise<boolean> {
        try {
            const r = await apiClient.post<{ canShowForgotPassword?: boolean }>(
                '/auth/forgot-password-eligibility',
                { email: email.trim(), role: toApiRole(role) },
            );
            return Boolean(r.canShowForgotPassword);
        } catch {
            return false;
        }
    },

    async requestForgotPassword(
        email: string,
        role: UserRole,
    ): Promise<{ ok: boolean; message: string }> {
        try {
            const r = await apiClient.post<{ message?: string }>('/auth/forgot-password', {
                email: email.trim(),
                role: toApiRole(role),
            });
            return { ok: true, message: r.message || '' };
        } catch (error: any) {
            return { ok: false, message: error?.message || 'Request failed' };
        }
    },

    async resetPassword(
        email: string,
        token: string,
        newPassword: string,
    ): Promise<{ ok: boolean; message?: string }> {
        try {
            await apiClient.post('/auth/reset-password', {
                email: email.trim(),
                token: token.trim(),
                newPassword,
            });
            return { ok: true };
        } catch (error: any) {
            return { ok: false, message: error?.message || 'Reset failed' };
        }
    },

    // Delete current user account (soft delete)
    async deleteAccount(): Promise<boolean> {
        try {
            await apiClient.post('/users/delete-self', {});
            return true;
        } catch (error) {
            console.error('Error deleting account:', error);
            return false;
        }
    },
};
