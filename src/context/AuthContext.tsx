import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';
import { apiClient } from '../services/apiClient';
import { User, UserRole, AuthContextType } from '../types/types';
import { normalizeUser } from '../utils/normalization';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = useCallback(async () => {
        console.log('AuthContext: Checking session...');

        try {
            const currentUser = await authService.getCurrentUser();
            console.log('AuthContext: Current user from service:', currentUser ? currentUser.email : 'null');
            setUser(normalizeUser(currentUser) || null);
        } catch (error) {
            console.error('AuthContext: Session check failed:', error);
        } finally {
            console.log('AuthContext: Finishing checkSession, setting isLoading to false');
            setIsLoading(false);
        }
    }, []);

    const login = useCallback(async (email: string, password: string, role: UserRole): Promise<boolean | string> => {
        try {
            const loggedInUser = await authService.login(email, password, role);
            if (loggedInUser) {
                setUser(normalizeUser(loggedInUser) || null);
                return true;
            }
            return false;
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

    const value = useMemo(() => ({
        user,
        login,
        signup,
        logout,
        isLoading,
        getPendingVendors,
        getApprovedVendors,
        updateUserStatus,
        removeVendor
    }), [user, login, signup, logout, isLoading, getPendingVendors, getApprovedVendors, updateUserStatus, removeVendor]);

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
