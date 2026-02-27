import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../apiClient';

// Mock fetch
global.fetch = jest.fn();

describe('apiClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        apiClient.clearCache();
    });

    it('should include Authorization header if token exists', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('fake-token');
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true }),
        });

        await apiClient.get('/test');

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/test'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer fake-token',
                }),
            })
        );
    });

    it('should throw error on non-ok response', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => 'Not Found',
        });

        await expect(apiClient.get('/error')).rejects.toThrow('HTTP error! status: 404');
    });

    it('should cache GET requests', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: 'cached' }),
        });

        await apiClient.get('/cached');
        await apiClient.get('/cached');

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on mutation', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        await apiClient.get('/data/1');
        await apiClient.post('/data/1', { updated: true });
        await apiClient.get('/data/1');

        expect(global.fetch).toHaveBeenCalledTimes(3);
    });
});
