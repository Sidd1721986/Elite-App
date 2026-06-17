import { useCallback, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { messageService } from '../services/messageService';
import type { Conversation } from '../types/types';

const POLL_MS = 30000;

/**
 * Loads message threads and exposes an unread total for the badge.
 * Unread state is surfaced via the badge only — no intrusive blocking Alert.
 */
export function useChatInboxNotifications() {
    const [conversations, setConversations] = useState<Conversation[]>([]);

    const messageUnreadTotal = useMemo(
        () => conversations.reduce((n, c) => n + (c.unreadCount || 0), 0),
        [conversations],
    );

    const refreshInbox = useCallback(async () => {
        try {
            const conv = await messageService.getConversations().catch(() => [] as Conversation[]);
            const sorted = [...(conv || [])].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            );
            setConversations(sorted);
        } catch {
            /* ignore */
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void refreshInbox();
            let appState = AppState.currentState;
            const id = setInterval(() => {
                if (appState === 'active') {
                    void refreshInbox();
                }
            }, POLL_MS);
            const appStateSub = AppState.addEventListener('change', (next) => {
                appState = next;
                if (next === 'active') {
                    void refreshInbox();
                }
            });
            return () => {
                clearInterval(id);
                appStateSub.remove();
            };
        }, [refreshInbox]),
    );

    return { messageUnreadTotal, refreshInbox, conversations };
}
