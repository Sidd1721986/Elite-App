import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, toApiRole } from '../services/authService';
import { apiClient, setApiClientOnUnauthorized } from '../services/apiClient';
import { User, UserRole, AuthContextType } from '../types/types';
import { normalizeUser } from '../utils/normalization';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    const checkSession = useCallback(async () => {
        try {
            const currentUser = await authService.getCurrentUser();
            setUser(normalizeUser(currentUser) || null);
            setIsOffline(false);
        } catch (error: any) {
            // Network errors (no connection, timeout) should not log the user out —
            // keep showing the last known user so they can still navigate offline.
            const isNetworkError =
                error?.message?.includes('Network') ||
                error?.message?.includes('timeout') ||
                error?.message?.includes('fetch') ||
                error?.name === 'AbortError';

            if (isNetworkError) {
                setIsOffline(true);
                if (__DEV__) console.warn('AuthContext: network unavailable, keeping cached session');
            } else {
                // Auth error (401, token expired) — clear session.
                setUser(null);
                setIsOffline(false);
                if (__DEV__) console.error('AuthContext: session check failed:', error);
            }
        }
    }, []);

    // Initial session check on app mount
    useEffect(() => {
        let isCurrent = true;

        const initSession = async () => {
            try {
                await checkSession();
            } finally {
                if (isCurrent) {
                    setIsLoading(false);
                }
            }
        };

        initSession();

        return () => {
            isCurrent = false;
        };
    }, [checkSession]);

    // On 401, clear auth so user is sent back to login.
    // Also clear the persisted job cache so a subsequent login doesn't briefly see
    // the previous user's jobs, and call setIsLoading(false) as a safety guard in
    // case the 401 fires before initSession's finally block runs.
    useEffect(() => {
        setApiClientOnUnauthorized(async () => {
            await authService.logout();
            apiClient.clearCache();
            await AsyncStorage.removeItem('@jobs_cache');
            setUser(null);
            setIsLoading(false);
        });
    }, []);

    const login = useCallback(async (email: string, password: string, role: UserRole): Promise<boolean | string> => {
        try {
            const loggedInUser = await authService.login(email, password, role);
            if (!loggedInUser) {
                return 'Invalid credentials or wrong role selected';
            }

            const normalized = normalizeUser(loggedInUser);
            if (!normalized) {
                return 'Login failed';
            }

            // Must match account type: Admin / Vendor / Customer (same mapping as API request).
            const expectedBackendRole = toApiRole(role);
            const actualRole = (normalized.role || '').toString().trim();
            if (actualRole.toLowerCase() !== expectedBackendRole.toLowerCase()) {
                // Clear any stored session just in case
                await authService.logout();
                apiClient.clearCache();
                setUser(null);
                return 'Invalid credentials or wrong role selected';
            }

            setUser(normalized);
            return true;
        } catch (error: any) {
            return error.message || 'Login failed';
        }
    }, []);

    const signup = useCallback(async (
        name: string,
        email: string,
        password: string,
        role: UserRole,
        address: string,
        phone: string,
        referralSource: string,
        roleOther?: string
    ): Promise<boolean | string> => {
        try {
            return await authService.signup(name, email, password, role, address, phone, referralSource, roleOther);
        } catch (error: any) {
            return error.message || 'Signup failed';
        }
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        apiClient.clearCache();
        // Clear the persisted job cache so the next user to log in on this device
        // doesn't briefly see stale data from the previous session.
        await AsyncStorage.removeItem('@jobs_cache');
        setUser(null);
    }, []);

    const getPendingVendors = useCallback(async () => {
        const vendors = await authService.getPendingVendors();
        return (vendors || []).map(v => normalizeUser(v)).filter(Boolean) as User[];
    }, []);

    const getApprovedVendors = useCallback(async () => {
        const vendors = await authService.getApprovedVendors();
        return (vendors || []).map(v => normalizeUser(v)).filter(Boolean) as User[];
    }, []);

    const updateUserStatus = useCallback(async (userId: string, approved: boolean) => {
        return await authService.updateUserStatus(userId, approved);
    }, []);

    const removeVendor = useCallback(async (userId: string) => {
        return await authService.removeVendor(userId);
    }, []);

    const deleteAccount = useCallback(async () => {
        try {
            const success = await authService.deleteAccount();
            if (success) {
                await logout();
                return true;
            }
            return 'Failed to deactivate account. Please try again.';
        } catch (error: any) {
            return error.message || 'Error deactivating account';
        }
    }, [logout]);

    const updateProfile = useCallback(async (data: Partial<User>): Promise<boolean | string> => {
        try {
            const updated = await authService.updateProfile(data);
            if (updated) {
                setUser(normalizeUser(updated) || null);
                return true;
            }
            return 'Failed to update profile';
        } catch (error: any) {
            return error.message || 'Error updating profile';
        }
    }, []);

    const requestPhoneVerification = useCallback(async () => {
        return await authService.requestPhoneVerification();
    }, []);

    const verifyPhone = useCallback(async (code: string) => {
        const success = await authService.verifyPhone(code);
        if (success) {
            // Refresh the user to get the new IsPhoneVerified state from server
            const freshUser = await authService.getProfile();
            setUser(normalizeUser(freshUser) || null);
        }
        return success;
    }, []);

    const value = useMemo(() => ({
        user,
        login,
        signup,
        logout,
        isLoading,
        isOffline,
        getPendingVendors,
        getApprovedVendors,
        updateUserStatus,
        removeVendor,
        deleteAccount,
        updateProfile,
        requestPhoneVerification,
        verifyPhone
    }), [
        user, login, signup, logout, isLoading, isOffline, getPendingVendors,
        getApprovedVendors, updateUserStatus, removeVendor, deleteAccount,
        updateProfile, requestPhoneVerification, verifyPhone
    ]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
