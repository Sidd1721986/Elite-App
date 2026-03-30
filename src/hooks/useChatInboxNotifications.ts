import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { messageService } from '../services/messageService';
import type { Conversation } from '../types/types';

const POLL_MS = 30000;

/**
 * Loads message threads, shows a badge count, and alerts when unread count increases
 * (e.g. admin replied) while this screen is focused.
 */
export function useChatInboxNotifications() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const prevUnreadRef = useRef<number | null>(null);

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

            const total = sorted.reduce((n, c) => n + (c.unreadCount || 0), 0);
            if (prevUnreadRef.current !== null && total > prevUnreadRef.current) {
                Alert.alert('New message', 'Someone replied to your chat. Tap the message icon to read.');
            }
            prevUnreadRef.current = total;
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
