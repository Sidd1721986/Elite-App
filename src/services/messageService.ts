import { apiClient } from './apiClient';
import { Message, Conversation } from '../types/types';
import { buildImageMessageContent } from '../utils/chatMessageContent';

export const messageService = {
    async sendMessage(receiverId: string, content: string): Promise<Message> {
        return apiClient.post<Message>('/messages', { receiverId, content });
    },

    async sendImageMessage(receiverId: string, imageUrl: string): Promise<Message> {
        return apiClient.post<Message>('/messages', {
            receiverId,
            content: buildImageMessageContent(imageUrl),
        });
    },

    async getMessages(otherUserId: string): Promise<Message[]> {
        // bypassCache: polling must see new messages, not a 5-min stale cache
        return apiClient.get<Message[]>(`/messages/${otherUserId}`, true);
    },

    async getConversations(): Promise<Conversation[]> {
        // bypassCache: inbox unread badges must update on each poll
        return apiClient.get<Conversation[]>('/messages/conversations', true);
    },

    async getDefaultAdminId(): Promise<string> {
        return apiClient.get<string>('/messages/admin-id');
    },
};
