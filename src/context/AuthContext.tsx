import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { authService } from '../services/authService';
import { User, UserRole, AuthContextType } from '../types/types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = useCallback(async () => {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
        setIsLoading(false);
    }, []);

    const login = useCallback(async (email: string, password: string, role: UserRole): Promise<boolean> => {
        const loggedInUser = await authService.login(email, password, role);
        if (loggedInUser) {
            setUser(loggedInUser);
            return true;
        }
        return false;
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
    ): Promise<boolean> => {
        return await authService.signup(name, email, password, role, address, phone, referralSource, roleOther);
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        setUser(null);
    }, []);

    const getPendingVendors = useCallback(async () => {
        return await authService.getPendingVendors();
    }, []);

    const updateUserStatus = useCallback(async (email: string, approved: boolean) => {
        return await authService.updateUserStatus(email, approved);
    }, []);

    const value = useMemo(() => ({
        user,
        login,
        signup,
        logout,
        isLoading,
        getPendingVendors,
        updateUserStatus
    }), [user, login, signup, logout, isLoading, getPendingVendors, updateUserStatus]);

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
