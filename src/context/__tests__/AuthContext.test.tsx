import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import { authService } from '../../services/authService';
import { UserRole } from '../../types/types';

jest.mock('../../services/authService', () => {
    const actual = jest.requireActual<typeof import('../../services/authService')>('../../services/authService');
    return {
        ...actual,
        authService: {
            ...actual.authService,
            getCurrentUser: jest.fn(),
            login: jest.fn(),
            logout: jest.fn(),
        },
    };
});
jest.mock('../../utils/normalization', () => ({
    normalizeUser: (user: any) => {
        if (!user || typeof user !== 'object') return undefined;
        return {
            ...user,
            id: String(user.id ?? ''),
            email: user.email ?? user.Email ?? '',
            role: user.role ?? user.Role ?? 'Customer',
            name: user.name ?? user.Name ?? '',
        };
    },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize with no user and loading true, then update from checkSession', async () => {
        const mockUser = { id: '1', name: 'Test User' };
        (authService.getCurrentUser as jest.Mock).mockResolvedValueOnce(mockUser);

        const { result } = renderHook(() => useAuth(), { wrapper });

        // Initial state before useEffect resolves
        expect(result.current.isLoading).toBe(true);

        // Wait for useEffect
        await act(async () => { });

        expect(result.current.user).toEqual(
            expect.objectContaining({ id: '1', name: 'Test User', email: '', role: 'Customer' }),
        );
        expect(result.current.isLoading).toBe(false);
    });

    it('login should update user state on success', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValueOnce(null);
        const mockUser = { id: '1', name: 'Logged In User', role: 'Customer' };
        (authService.login as jest.Mock).mockResolvedValueOnce(mockUser);

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => { }); // wait for mount check

        await act(async () => {
            const success = await result.current.login('test@test.com', 'password', UserRole.CUSTOMER);
            expect(success).toBe(true);
        });

        expect(result.current.user).toEqual(
            expect.objectContaining({ id: '1', name: 'Logged In User', role: 'Customer', email: '' }),
        );
    });

    it('logout should clear user state', async () => {
        const mockUser = { id: '1', name: 'Test User' };
        (authService.getCurrentUser as jest.Mock).mockResolvedValueOnce(mockUser);

        const { result } = renderHook(() => useAuth(), { wrapper });
        await act(async () => { });

        expect(result.current.user).toEqual(
            expect.objectContaining({ id: '1', name: 'Test User', email: '', role: 'Customer' }),
        );

        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.user).toBeNull();
    });
});
