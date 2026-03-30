import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { authService, toApiRole } from '../services/authService';
import { apiClient, setApiClientOnUnauthorized } from '../services/apiClient';
import { User, UserRole, AuthContextType } from '../types/types';
import { normalizeUser } from '../utils/normalization';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSession = useCallback(async () => {
        try {
            const currentUser = await authService.getCurrentUser();
            setUser(normalizeUser(currentUser) || null);
        } catch (error) {
            if (__DEV__) console.error('AuthContext: Session check failed:', error);
        }
    }, []);

    // Run session check in background (timeout avoids infinite “Loading…” if storage hangs)
    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            if (!cancelled) setIsLoading(false);
        }, 2500);
        checkSession()
            .catch((error) => {
                if (__DEV__) console.error('AuthContext: Session check failed:', error);
            })
            .finally(() => {
                clearTimeout(timer);
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [checkSession]);

    // On 401, clear auth so user is sent back to login
    useEffect(() => {
        setApiClientOnUnauthorized(async () => {
            await authService.logout();
            apiClient.clearCache();
            setUser(null);
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

    const value = useMemo(() => ({
        user,
        login,
        signup,
        logout,
        isLoading,
        getPendingVendors,
        getApprovedVendors,
        updateUserStatus,
        removeVendor,
        deleteAccount
    }), [user, login, signup, logout, isLoading, getPendingVendors, getApprovedVendors, updateUserStatus, removeVendor, deleteAccount]);

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
