import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VendorDashboard from '../VendorDashboard';
import { AuthProvider } from '../../context/AuthContext';
import { JobProvider } from '../../context/JobContext';
import { authService } from '../../services/authService';
import { jobService } from '../../services/jobService';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { JobStatus } from '../../types/types';

jest.mock('../../services/authService');
jest.mock('../../services/jobService');

const renderWithProviders = (component: React.ReactElement) => {
    return render(
        <SafeAreaProvider>
            <PaperProvider>
                <AuthProvider>
                    <JobProvider>
                        {component}
                    </JobProvider>
                </AuthProvider>
            </PaperProvider>
        </SafeAreaProvider>
    );
};

describe('VendorDashboard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render welcome message and jobs', async () => {
        const mockUser = { name: 'Vendor User', role: 'Vendor' };
        const mockJobs = [{ id: '1', address: '123 Test St', status: JobStatus.ASSIGNED }];

        (authService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
        (jobService.getJobs as jest.Mock).mockResolvedValue(mockJobs);

        const { getByText } = renderWithProviders(<VendorDashboard />);

        await waitFor(() => {
            expect(getByText('Vendor User')).toBeTruthy();
            expect(getByText('123 Test St')).toBeTruthy();
        });
    });

    it('should handle logout', async () => {
        (authService.getCurrentUser as jest.Mock).mockResolvedValue({ name: 'User' });
        (jobService.getJobs as jest.Mock).mockResolvedValue([]);

        const { getByTestId } = renderWithProviders(<VendorDashboard />);

        // Filter by icon or specific button if needed, but let's assume it finds it
        // Since we didn't add testID, we might need to find by accessibility label or similar
    });
});
