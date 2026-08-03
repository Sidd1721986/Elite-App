import { useCallback, useMemo, useRef, useState } from 'react';
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
    // True only while the screen is focused; gates setState so a poll that resolves after
    // blur/unmount can't update an unmounted component (setState-after-unmount warning).
    const activeRef = useRef(false);
    // Prevents overlapping polls: on a slow network a 30s interval could otherwise fire a
    // second request before the first resolved, stacking duplicate calls.
    const inFlightRef = useRef(false);

    const messageUnreadTotal = useMemo(
        () => conversations.reduce((n, c) => n + (c.unreadCount || 0), 0),
        [conversations],
    );

    const refreshInbox = useCallback(async () => {
        if (inFlightRef.current) { return; }
        inFlightRef.current = true;
        try {
            // No fallback to []: a single transient failure would wipe the thread list and
            // zero the unread badge. Keep the last known state and retry on the next poll.
            const conv = await messageService.getConversations();
            if (!activeRef.current) { return; }
            const sorted = [...(conv || [])].sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            );
            setConversations(sorted);
        } catch {
            /* keep last-known conversations */
        } finally {
            inFlightRef.current = false;
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            activeRef.current = true;
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
                activeRef.current = false;
                clearInterval(id);
                appStateSub.remove();
            };
        }, [refreshInbox]),
    );

    return { messageUnreadTotal, refreshInbox, conversations };
}
