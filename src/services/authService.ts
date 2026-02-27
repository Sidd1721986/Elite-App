import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types/types';
import { apiClient } from './apiClient';

const USERS_KEY = '@users';

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
    ): Promise<boolean> {
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
        } catch (error) {
            console.error('Error signing up:', error);
            return false;
        }
    },

    // Login user
    async login(email: string, password: string, role: UserRole): Promise<User | null> {
        try {
            let apiRole = 'Customer';
            if (role === UserRole.ADMIN) apiRole = 'Admin';
            else if (role === UserRole.VENDOR) apiRole = 'Vendor';

            const response = await apiClient.post<{ token: string, user: any }>('/auth/login', {
                email,
                password,
                role: apiRole
            });

            if (response.token) {
                await AsyncStorage.setItem('@auth_token', response.token);
                const user: User = {
                    ...response.user,
                    role: role, // Keep the granular role locally for UI consistency
                };
                await AsyncStorage.setItem('@current_user', JSON.stringify(user));
                return user;
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
        } catch (error) {
            console.error('Error logging out:', error);
        }
    },

    // Get users pending vendor approval
    async getPendingVendors(): Promise<User[]> {
        try {
            return await apiClient.get<User[]>('/users/pending-vendors');
        } catch (error) {
            console.error('Error getting pending vendors:', error);
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

    // Get users who are approved vendors
    async getApprovedVendors(): Promise<User[]> {
        try {
            return await apiClient.get<User[]>('/users/approved-vendors');
        } catch (error) {
            console.error('Error getting approved vendors:', error);
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
};
