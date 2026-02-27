import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../authService';
import { apiClient } from '../apiClient';
import { UserRole } from '../../types/types';

jest.mock('../apiClient');

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

        it('should return false if apiClient.post fails', async () => {
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

            expect(result).toBe(false);
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
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('@auth_token', 'fake-token');
            expect(AsyncStorage.setItem).toHaveBeenCalledWith('@current_user', JSON.stringify({ ...mockUser, role: UserRole.CUSTOMER }));
            expect(result).toEqual({ ...mockUser, role: UserRole.CUSTOMER });
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
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_token');
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
