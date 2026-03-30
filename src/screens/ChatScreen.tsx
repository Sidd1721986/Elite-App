import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FlashList } from '@shopify/flash-list';
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    AppState,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Text, Avatar, IconButton, Surface, useTheme, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useIsFocused } from '@react-navigation/native';
import { RootStackParamList, Message } from '../types/types';
import { messageService } from '../services/messageService';
import { useAuth } from '../context/AuthContext';

type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

const ChatScreen: React.FC = () => {
    const route = useRoute<ChatRouteProp>();
    const navigation = useNavigation();
    const { user } = useAuth();
    const theme = useTheme();
    const isFocused = useIsFocused();
    const otherUserId = route.params?.otherUserId;
    const otherUserName = route.params?.otherUserName ?? 'Chat';

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<any>(null);

    const [resolvedOtherUserId, setResolvedOtherUserId] = useState(otherUserId === 'admin' ? '' : otherUserId);

    const loadMessages = useCallback(async () => {
        if (!resolvedOtherUserId) return;
        try {
            const data = await messageService.getMessages(resolvedOtherUserId);
            setMessages(data);
        } catch (error) {
            console.error('Failed to load messages:', error);
        } finally {
            setLoading(false);
        }
    }, [resolvedOtherUserId]);

    useEffect(() => {
        const init = async () => {
            if (otherUserId === 'admin') {
                try {
                    const id = await messageService.getDefaultAdminId();
                    setResolvedOtherUserId(id);
                } catch (error) {
                    console.error('Failed to resolve admin ID:', error);
                    setLoading(false);
                }
            }
        };
        init();
    }, [otherUserId]);

    useEffect(() => {
        if (!resolvedOtherUserId || !isFocused) return;
        loadMessages();
        let appState = AppState.currentState;
        const interval = setInterval(() => {
            if (appState === 'active') {
                void loadMessages();
            }
        }, 20000);
        const appStateSub = AppState.addEventListener('change', (next) => {
            appState = next;
            if (next === 'active') {
                void loadMessages();
            }
        });
        return () => {
            clearInterval(interval);
            appStateSub.remove();
        };
    }, [loadMessages, resolvedOtherUserId, isFocused]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || sending || !resolvedOtherUserId) return;

        setSending(true);
        try {
            const newMessage = await messageService.sendMessage(resolvedOtherUserId, inputText.trim());
            setMessages(prev => [...prev, newMessage]);
            setInputText('');
            // Scroll to bottom
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            Alert.alert('Error', 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const renderMessage = useCallback(({ item }: { item: Message }) => {
        const isMe = item.senderId === user?.id || item.senderId === user?.email; // Fallback check

        return (
            <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                {!isMe && (
                    <Avatar.Text
                        size={32}
                        label={otherUserName.substring(0, 1)}
                        style={styles.avatar}
                    />
                )}
                <Surface style={[
                    styles.messageBubble,
                    isMe ? styles.myBubble : styles.theirBubble
                ]} elevation={1}>
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {item.content}
                    </Text>
                    <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </Surface>
            </View>
        );
    }, [user?.id, user?.email, otherUserName]);

    if (!otherUserId) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.centered}>
                    <Text variant="titleMedium" style={{ marginBottom: 16 }}>Invalid conversation</Text>
                    <Button mode="contained" onPress={() => navigation.goBack()}>Go back</Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            {/* Header */}
            <Surface style={styles.header} elevation={2}>
                <IconButton icon="chevron-left" onPress={() => navigation.goBack()} />
                <View style={styles.headerInfo}>
                    <Text variant="titleMedium" style={styles.headerName}>{otherUserName}</Text>
                    <Text variant="labelSmall" style={styles.headerStatus}>Online</Text>
                </View>
                <IconButton icon="dots-vertical" />
            </Surface>

            {/* Glowing Decorations (Behind) */}
            <View style={styles.glow1} />
            <View style={styles.glow2} />

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={theme.colors.primary} size="large" />
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <FlashList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.listContent}
                        estimatedItemSize={80}
                    />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <Surface style={styles.inputContainer} elevation={4}>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#94A3B8"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={!inputText.trim() || sending}
                    >
                        <IconButton
                            icon="send"
                            iconColor="white"
                            size={24}
                            style={{ margin: 0 }}
                        />
                    </TouchableOpacity>
                </Surface>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 4,
    },
    headerName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    headerStatus: {
        color: '#10B981',
    },
    glow1: {
        position: 'absolute',
        top: 100,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#6366F110',
    },
    glow2: {
        position: 'absolute',
        bottom: 100,
        left: -50,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#06B6D410',
    },
    listContent: {
        padding: 16,
        paddingBottom: 32,
    },
    messageWrapper: {
        flexDirection: 'row',
        marginBottom: 16,
        maxWidth: '80%',
    },
    myMessageWrapper: {
        alignSelf: 'flex-end',
        flexDirection: 'row-reverse',
    },
    theirMessageWrapper: {
        alignSelf: 'flex-start',
    },
    avatar: {
        marginRight: 8,
        backgroundColor: '#EEF2FF',
    },
    messageBubble: {
        padding: 12,
        borderRadius: 20,
        minWidth: 80,
    },
    myBubble: {
        backgroundColor: '#6366F1',
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: 'white',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    myMessageText: {
        color: 'white',
    },
    theirMessageText: {
        color: '#1E293B',
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    myTimestamp: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    theirTimestamp: {
        color: '#94A3B8',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
    },
    input: {
        flex: 1,
        backgroundColor: '#F1F5F9',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 100,
        color: '#1E293B',
        fontSize: 15,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#6366F1',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    sendButtonDisabled: {
        backgroundColor: '#CBD5E1',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default ChatScreen;
