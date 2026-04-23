import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../authService';
import { apiClient } from '../apiClient';
import { UserRole } from '../../types/types';
import { SecureStorage } from '../secureStorage';

jest.mock('../apiClient');
jest.mock('../secureStorage', () => ({
    SecureStorage: {
        setItem: jest.fn(() => Promise.resolve(true)),
        removeItem: jest.fn(() => Promise.resolve(true)),
        getItem: jest.fn(() => Promise.resolve(null)),
    },
}));

describe('authService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('signup', () => {
        it('should call apiClient.post with correct data and return true on success', async () => {
            (apiClient.post as jest.Mock).mockResolvedValueOnce({});

            const result = await authService.signup(
                'Test User',
                'test@example.com',
                'password123',
                UserRole.CUSTOMER,
                '123 Main St',
                '555-0101',
                'Referral'
            );

            expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                role: 'Customer',
                address: '123 Main St',
                phone: '555-0101',
            });
            expect(result).toBe(true);
        });

        it('should return error message if apiClient.post fails', async () => {
            (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Signup failed'));

            const result = await authService.signup(
                'Test User',
                'test@example.com',
                'password123',
                UserRole.CUSTOMER,
                '123 Main St',
                '555-0101',
                'Referral'
            );

            expect(result).toBe('Signup failed');
        });

        it('should return a helpful message on network failure', async () => {
            (apiClient.post as jest.Mock).mockRejectedValueOnce(new TypeError('Network request failed'));

            const result = await authService.signup(
                'Test User',
                'test@example.com',
                'password123',
                UserRole.CUSTOMER,
                '123 Main St',
                '555-0101',
                'Referral'
            );

            expect(typeof result).toBe('string');
            expect(result).toMatch(/Cannot reach the API/);
        });
    });

    describe('login', () => {
        it('should call apiClient.post, store token/user, and return user on success', async () => {
            const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
            const mockResponse = { token: 'fake-token', user: mockUser };
            (apiClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

            const result = await authService.login('test@example.com', 'password123', UserRole.CUSTOMER);

            expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
                email: 'test@example.com',
                password: 'password123',
                role: 'Customer',
            });
            expect(SecureStorage.setItem).toHaveBeenCalledWith('auth_token', 'fake-token');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('@current_user', JSON.stringify(mockUser));
            expect(result).toEqual(mockUser);
        });

        it('should throw error if login fails', async () => {
            (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

            await expect(authService.login('test@example.com', 'wrong-pass', UserRole.CUSTOMER))
                .rejects.toThrow('Invalid credentials');
        });
    });

    describe('logout', () => {
        it('should clear stored token and user', async () => {
            await authService.logout();
            expect(SecureStorage.removeItem).toHaveBeenCalledWith('auth_token');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@current_user');
        });
    });

    describe('getCurrentUser', () => {
        it('should return parsed user from AsyncStorage', async () => {
            const mockUser = { id: '1', name: 'Test User', email: 'test@example.com', role: UserRole.CUSTOMER };
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockUser));

            const user = await authService.getCurrentUser();
            expect(user).toEqual(mockUser);
        });

        it('should return null if no user is found in AsyncStorage', async () => {
            (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

            const user = await authService.getCurrentUser();
            expect(user).toBeNull();
        });
    });
});
