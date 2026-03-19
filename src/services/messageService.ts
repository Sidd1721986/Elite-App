import { apiClient } from './apiClient';
import { Message, Conversation } from '../types/types';

export const messageService = {
    async sendMessage(receiverId: string, content: string): Promise<Message> {
        return apiClient.post<Message>('/messages', { receiverId, content });
    },

    async getMessages(otherUserId: string): Promise<Message[]> {
        return apiClient.get<Message[]>(`/messages/${otherUserId}`);
    },

    async getConversations(): Promise<Conversation[]> {
        return apiClient.get<Conversation[]>('/messages/conversations');
    },

    async getDefaultAdminId(): Promise<string> {
        return apiClient.get<string>('/messages/admin-id');
    }
};
