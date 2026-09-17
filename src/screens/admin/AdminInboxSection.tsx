import * as React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Surface, Text, Avatar, Divider, IconButton } from 'react-native-paper';
import { Conversation } from '../../types/types';
import { formatChatPreview } from '../../utils/chatMessageContent';

interface AdminInboxSectionProps {
    conversations: Conversation[];
    messageUnreadTotal: number;
    onSelectConversation: (userId: string, userName: string) => void;
    onDeleteConversation: (userId: string, userName: string) => void;
}

export const AdminInboxSection: React.FC<AdminInboxSectionProps> = React.memo(({
    conversations,
    messageUnreadTotal,
    onSelectConversation,
    onDeleteConversation,
}) => {
    return (
        <View style={styles.sectionWrap}>
            <Surface style={styles.surfaceCard} elevation={0}>
                <View style={styles.inner}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Avatar.Icon
                                size={40}
                                icon="message-text-outline"
                                style={styles.headerAvatar}
                                color="#6366F1"
                            />
                            <View style={styles.headerTextWrap}>
                                <Text variant="titleMedium" style={styles.title}>
                                    Inbox & Live Chat
                                </Text>
                                <Text variant="bodySmall" style={styles.subtitle}>
                                    Direct messages with customers & vendors
                                </Text>
                            </View>
                        </View>
                        {messageUnreadTotal > 0 ? (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{messageUnreadTotal}</Text>
                            </View>
                        ) : (
                            <Text variant="labelSmall" style={styles.threadCount}>
                                {conversations.length} {conversations.length === 1 ? 'thread' : 'threads'}
                            </Text>
                        )}
                    </View>

                    {conversations.length > 0 ? (
                        conversations.map((c, index) => {
                            const unread = c.unreadCount || 0;
                            const timeStr = c.timestamp
                                ? new Date(c.timestamp).toLocaleString([], {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                  })
                                : '';
                            const userName = c.otherUserName || c.otherUserEmail || 'User';

                            return (
                                <React.Fragment key={String(c.otherUserId)}>
                                    {index > 0 && <Divider style={styles.rowDivider} />}
                                    <Pressable
                                        onPress={() => onSelectConversation(String(c.otherUserId), userName)}
                                        style={({ pressed }) => [
                                            styles.row,
                                            pressed && styles.rowPressed,
                                        ]}
                                    >
                                        <Avatar.Text
                                            size={44}
                                            label={userName.substring(0, 2).toUpperCase()}
                                            style={styles.avatar}
                                            labelStyle={styles.avatarLabel}
                                        />
                                        <View style={styles.body}>
                                            <View style={styles.topLine}>
                                                <Text
                                                    variant="titleSmall"
                                                    style={[styles.name, unread > 0 && styles.nameUnread]}
                                                    numberOfLines={1}
                                                >
                                                    {userName}
                                                </Text>
                                                <View style={styles.timeWrap}>
                                                    {unread > 0 && (
                                                        <View style={styles.unreadPill}>
                                                            <Text style={styles.unreadPillText}>{unread}</Text>
                                                        </View>
                                                    )}
                                                    <Text style={styles.time} numberOfLines={1}>
                                                        {timeStr}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text
                                                variant="bodySmall"
                                                style={[styles.preview, unread > 0 && styles.previewUnread]}
                                                numberOfLines={2}
                                            >
                                                {formatChatPreview(c.latestMessage || '') || 'No preview'}
                                            </Text>
                                        </View>
                                        <IconButton
                                            icon="trash-can-outline"
                                            size={20}
                                            iconColor="#EF4444"
                                            style={styles.actionIcon}
                                            onPress={() => onDeleteConversation(String(c.otherUserId), userName)}
                                            testID={`delete_conversation_${index}`}
                                        />
                                        <IconButton
                                            icon="chevron-right"
                                            size={20}
                                            iconColor="#CBD5E1"
                                            style={styles.actionIcon}
                                        />
                                    </Pressable>
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <View style={styles.emptyWrap}>
                            <IconButton icon="email-outline" size={40} iconColor="#CBD5E1" />
                            <Text variant="titleSmall" style={styles.emptyText}>
                                No messages yet
                            </Text>
                        </View>
                    )}
                </View>
            </Surface>
        </View>
    );
});

const styles = StyleSheet.create({
    sectionWrap: {
        marginBottom: 16,
    },
    surfaceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    inner: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerAvatar: {
        backgroundColor: '#EEF2FF',
    },
    headerTextWrap: {
        marginLeft: 12,
        flex: 1,
    },
    title: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    subtitle: {
        color: '#64748B',
    },
    unreadBadge: {
        backgroundColor: '#EF4444',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    unreadBadgeText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
    threadCount: {
        color: '#94A3B8',
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
    },
    rowPressed: {
        opacity: 0.7,
    },
    rowDivider: {
        backgroundColor: '#F1F5F9',
    },
    avatar: {
        backgroundColor: '#EEF2FF',
    },
    avatarLabel: {
        color: '#6366F1',
        fontWeight: 'bold',
        fontSize: 14,
    },
    body: {
        flex: 1,
        marginLeft: 12,
    },
    topLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    name: {
        color: '#1E293B',
        fontWeight: '600',
        flex: 1,
    },
    nameUnread: {
        fontWeight: 'bold',
        color: '#0F172A',
    },
    timeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    unreadPill: {
        backgroundColor: '#6366F1',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    unreadPillText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    time: {
        color: '#94A3B8',
        fontSize: 11,
    },
    preview: {
        color: '#64748B',
        marginTop: 2,
    },
    previewUnread: {
        color: '#1E293B',
        fontWeight: '600',
    },
    actionIcon: {
        margin: 0,
    },
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    emptyText: {
        color: '#94A3B8',
        marginTop: 4,
    },
});
