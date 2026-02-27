import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';
import { AuthProvider } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../../services/authService');

const mockNavigation = {
    navigate: jest.fn(),
};

const renderWithProviders = (component: React.ReactElement) => {
    return render(
        <SafeAreaProvider>
            <PaperProvider>
                <AuthProvider>
                    {component}
                </AuthProvider>
            </PaperProvider>
        </SafeAreaProvider>
    );
};

describe('LoginScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should update email and password fields', () => {
        const { getByPlaceholderText } = renderWithProviders(<LoginScreen navigation={mockNavigation as any} />);

        const emailInput = getByPlaceholderText('your@email.com');
        const passwordInput = getByPlaceholderText('••••••••');

        fireEvent.changeText(emailInput, 'test@example.com');
        fireEvent.changeText(passwordInput, 'password123');

        expect(emailInput.props.value).toBe('test@example.com');
        expect(passwordInput.props.value).toBe('password123');
    });

    it('should call login and navigate on success', async () => {
        (authService.login as jest.Mock).mockResolvedValueOnce({ id: '1', role: 'Customer' });
        (authService.getCurrentUser as jest.Mock).mockResolvedValueOnce(null);

        const { getByText, getByPlaceholderText } = renderWithProviders(<LoginScreen navigation={mockNavigation as any} />);

        fireEvent.changeText(getByPlaceholderText('your@email.com'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('••••••••'), 'password123');
        fireEvent.press(getByText('Log In'));

        await waitFor(() => {
            expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123', 'Customer');
        });
    });

    it('should show error message on login failure', async () => {
        (authService.login as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));
        (authService.getCurrentUser as jest.Mock).mockResolvedValueOnce(null);

        const { getByText, getByPlaceholderText } = renderWithProviders(<LoginScreen navigation={mockNavigation as any} />);

        fireEvent.changeText(getByPlaceholderText('your@email.com'), 'test@example.com');
        fireEvent.changeText(getByPlaceholderText('••••••••'), 'wrong-pass');
        fireEvent.press(getByText('Log In'));

        await waitFor(() => {
            expect(getByText('Invalid credentials')).toBeTruthy();
        });
    });
});
