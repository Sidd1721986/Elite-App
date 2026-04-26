import * as React from 'react';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { FlashList } from '@shopify/flash-list';

/** FlashList v2 typings omit `estimatedItemSize`; keep for layout performance. */
const FlashListCompat = FlashList as any;
import {
    View,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    AppState,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Pressable,
} from 'react-native';
import { Text, Avatar, IconButton, Surface, useTheme, Button, Menu } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp, useIsFocused } from '@react-navigation/native';
import FastImage from 'react-native-fast-image';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { RootStackParamList, Message } from '../types/types';
import { messageService } from '../services/messageService';
import { jobService } from '../services/jobService';
import { useAuth } from '../context/AuthContext';
import { parseChatMessageContent } from '../utils/chatMessageContent';
import { SUPPORT_URL } from '../config/appConfig';
import { openExternalUrl } from '../utils/openExternalUrl';

type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

// Defined at module scope so React sees a stable component type on every render.
// Previously this was inside ChatScreen, causing full list unmount/remount every
// time the parent re-rendered (React treats a new function reference as a new component).
const MessageItem = memo(({ item, isMe, otherUserName }: {
    item: Message;
    isMe: boolean;
    otherUserName: string;
}) => {
    const parsed = parseChatMessageContent(item.content);
    const openImage = () => {
        if (parsed.kind !== 'image') {return;}
        Linking.openURL(parsed.url).catch(() => {
            Alert.alert('Unable to open', 'This image link could not be opened.');
        });
    };
    return (
        <View style={[styles.messageWrapper, isMe ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
            {!isMe && (
                <Avatar.Text
                    size={34}
                    label={otherUserName.substring(0, 1).toUpperCase()}
                    style={styles.avatar}
                />
            )}
            <Surface style={[
                styles.messageBubble,
                isMe ? styles.myBubble : styles.theirBubble,
                parsed.kind === 'image' && styles.messageBubbleImage,
            ]} elevation={1}>
                {parsed.kind === 'image' ? (
                    <Pressable onPress={openImage} accessibilityRole="imagebutton" accessibilityLabel="Open shared photo">
                        <FastImage
                            source={{ uri: parsed.url, priority: FastImage.priority.normal }}
                            style={styles.messageImage}
                            resizeMode={FastImage.resizeMode.cover}
                            onError={() => {
                                // Image failed to load — FastImage will show blank;
                                // the Pressable still lets the user open the URL directly.
                                if (__DEV__) {console.warn('Chat image failed to load:', parsed.url);}
                            }}
                        />
                    </Pressable>
                ) : (
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {parsed.text}
                    </Text>
                )}
                <Text style={[styles.timestamp, isMe ? styles.myTimestamp : styles.theirTimestamp]}>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </Surface>
        </View>
    );
});

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
    const [imageSending, setImageSending] = useState(false);
    const [attachMenuVisible, setAttachMenuVisible] = useState(false);
    const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const flatListRef = useRef<any>(null);
    /** Array of pending scroll timeouts — cleared on unmount to prevent setState-after-unmount. */
    const scrollTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const [resolvedOtherUserId, setResolvedOtherUserId] = useState(otherUserId === 'admin' ? '' : otherUserId);

    // Consecutive failure counter drives exponential backoff for the polling interval.
    // Resets to 0 on a successful fetch so the interval snaps back to 20 s when healthy.
    const pollFailCountRef = useRef(0);
    // Holds the active polling timeout so we can cancel it on cleanup / on success reset.
    const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadMessages = useCallback(async () => {
        if (!resolvedOtherUserId) {return;}
        try {
            const data = await messageService.getMessages(resolvedOtherUserId);
            setMessages(data);
            // Reset backoff on success.
            pollFailCountRef.current = 0;
        } catch (error) {
            console.error('Failed to load messages:', error);
            pollFailCountRef.current += 1;
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
                    if (__DEV__) {console.error('Failed to resolve admin ID:', error);}
                    // Release the spinner so the user isn't stuck on a blank screen.
                    setLoading(false);
                }
            }
        };
        init();
    }, [otherUserId]);

    useEffect(() => {
        if (!resolvedOtherUserId || !isFocused) {return;}

        // Base interval: 20 s. Each consecutive failure doubles it, capped at 5 min.
        // Calculated fresh before each schedule so success resets snaps back immediately.
        const nextPollDelay = () => {
            const failures = pollFailCountRef.current;
            const backoff = Math.min(20000 * Math.pow(2, failures), 300000);
            return backoff;
        };

        let appState = AppState.currentState;
        let cancelled = false;

        const schedulePoll = () => {
            if (cancelled) {return;}
            pollTimeoutRef.current = setTimeout(async () => {
                if (cancelled) {return;}
                if (appState === 'active') {
                    await loadMessages();
                }
                schedulePoll();
            }, nextPollDelay());
        };

        void loadMessages();
        schedulePoll();

        const appStateSub = AppState.addEventListener('change', (next) => {
            appState = next;
            if (next === 'active') {
                // Foreground resume: cancel pending backoff timeout and poll immediately,
                // then re-schedule from a clean slate so the interval resets to 20 s.
                if (pollTimeoutRef.current) {clearTimeout(pollTimeoutRef.current);}
                pollFailCountRef.current = 0;
                void loadMessages().then(() => { if (!cancelled) {schedulePoll();} });
            }
        });

        return () => {
            cancelled = true;
            if (pollTimeoutRef.current) {clearTimeout(pollTimeoutRef.current);}
            appStateSub.remove();
        };
    }, [loadMessages, resolvedOtherUserId, isFocused]);

    const scheduleScrollToBottom = useCallback(() => {
        const t = setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        scrollTimeoutsRef.current.push(t);
    }, []);

    const pickAndSendImage = useCallback(async (source: 'camera' | 'library') => {
        if (!resolvedOtherUserId || imageSending || sending) {return;}
        setAttachMenuVisible(false);
        const options = { mediaType: 'photo' as const, quality: 0.8 as const };
        let result;
        try {
            result = source === 'camera'
                ? await launchCamera(options)
                : await launchImageLibrary(options);
        } catch (e) {
            // Native picker threw (e.g. permission denied at OS level on Android)
            if (__DEV__) {console.warn('Image picker failed to open:', e);}
            Alert.alert('Permission Denied', 'Please allow camera or photo access in Settings.');
            return;
        }
        if (result.didCancel || !result.assets?.[0]?.uri) {return;}
        const asset = result.assets[0];
        setImageSending(true);
        try {
            const fileToUpload = {
                uri: asset.uri!,
                type: asset.type || 'image/jpeg',
                name: asset.fileName || 'chat.jpg',
            };
            const uploadResult = await jobService.uploadFile(fileToUpload);
            if (!uploadResult?.url) {throw new Error('Upload failed');}
            const newMessage = await messageService.sendImageMessage(resolvedOtherUserId, uploadResult.url);
            setMessages(prev => [...prev, newMessage]);
            scheduleScrollToBottom();
        } catch (e) {
            if (__DEV__) {console.error('Chat image send failed:', e);}
            Alert.alert('Error', 'Could not send photo. Please try again.');
        } finally {
            setImageSending(false);
        }
    }, [resolvedOtherUserId, imageSending, sending, scheduleScrollToBottom]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || sending || imageSending || !resolvedOtherUserId) {return;}

        setSending(true);
        try {
            const newMessage = await messageService.sendMessage(resolvedOtherUserId, inputText.trim());
            setMessages(prev => [...prev, newMessage]);
            setInputText('');
            scheduleScrollToBottom();
        } catch (error) {
            Alert.alert('Error', 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    useEffect(() => {
        return () => {
            scrollTimeoutsRef.current.forEach(clearTimeout);
            scrollTimeoutsRef.current = [];
        };
    }, []);
    const renderMessage = useCallback(({ item }: { item: Message }) => {
        const isMe = item.senderId === user?.id || item.senderId === user?.email;
        return (
            <MessageItem
                item={item}
                isMe={isMe}
                otherUserName={otherUserName}
            />
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
                <Menu
                    visible={headerMenuVisible}
                    onDismiss={() => setHeaderMenuVisible(false)}
                    anchor={
                        <IconButton
                            icon="dots-vertical"
                            accessibilityLabel="Chat options"
                            onPress={() => setHeaderMenuVisible(true)}
                        />
                    }
                >
                    <Menu.Item
                        leadingIcon="shield-alert-outline"
                        title="Safety & reporting"
                        onPress={() => {
                            setHeaderMenuVisible(false);
                            void openExternalUrl(SUPPORT_URL);
                        }}
                    />
                    <Menu.Item
                        leadingIcon="information-outline"
                        title="About this chat"
                        onPress={() => {
                            setHeaderMenuVisible(false);
                            Alert.alert(
                                'Job-related messaging',
                                'Messages are for coordinating work between customers, vendors, and administrators. Harassment, threats, spam, or illegal content may result in account action. Report concerns from the support page (Profile → Contact Support).',
                            );
                        }}
                    />
                </Menu>
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
                    <FlashListCompat
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item: Message) => item.id}
                        contentContainerStyle={styles.listContent}
                        estimatedItemSize={100}
                    />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <Surface style={styles.inputContainer} elevation={4}>
                    <Menu
                        visible={attachMenuVisible}
                        onDismiss={() => setAttachMenuVisible(false)}
                        anchor={
                            <View style={styles.attachAnchorWrap}>
                                <IconButton
                                    icon="image-outline"
                                    iconColor="#6366F1"
                                    size={22}
                                    style={styles.attachButton}
                                    accessibilityLabel="Add photo to chat"
                                    onPress={() => setAttachMenuVisible(true)}
                                    disabled={
                                        !resolvedOtherUserId || sending || imageSending || loading
                                    }
                                />
                            </View>
                        }
                    >
                        <Menu.Item
                            leadingIcon="camera"
                            title="Take photo"
                            onPress={() => {
                                void pickAndSendImage('camera');
                            }}
                        />
                        <Menu.Item
                            leadingIcon="image-multiple"
                            title="Choose from gallery"
                            onPress={() => {
                                void pickAndSendImage('library');
                            }}
                        />
                    </Menu>
                    <TextInput
                        style={styles.input}
                        placeholder="Type a message..."
                        placeholderTextColor="#94A3B8"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                        editable={!imageSending}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!inputText.trim() || imageSending) && styles.sendButtonDisabled]}
                        onPress={handleSendMessage}
                        disabled={!inputText.trim() || sending || imageSending}
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
    messageBubbleImage: {
        padding: 8,
    },
    messageImage: {
        width: 200,
        height: 160,
        borderRadius: 12,
        backgroundColor: '#E2E8F0',
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
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
    },
    attachAnchorWrap: {
        backgroundColor: '#EEF2FF',
        borderRadius: 22,
        marginRight: 4,
        overflow: 'hidden',
    },
    attachButton: {
        margin: 0,
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
    },
});

export default ChatScreen;
