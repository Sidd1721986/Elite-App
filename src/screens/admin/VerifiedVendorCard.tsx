import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Avatar, Text, IconButton, Button, Menu } from 'react-native-paper';
import { User } from '../../types/types';

interface VerifiedVendorCardProps {
    vendor: User;
    onChat: (vendor: User) => void;
    onRemoveVendor: (vendor: User) => void;
    onDeleteVendorPermanently: (vendor: User) => void;
}

export const VerifiedVendorCard: React.FC<VerifiedVendorCardProps> = React.memo(({
    vendor,
    onChat,
    onRemoveVendor,
    onDeleteVendorPermanently,
}) => {
    const [menuVisible, setMenuVisible] = React.useState(false);

    return (
        <Card style={styles.card} elevation={0}>
            <Card.Content style={styles.cardInner}>
                <View style={styles.header}>
                    <Avatar.Text
                        size={40}
                        label={(vendor.name || vendor.email || '??').substring(0, 2).toUpperCase()}
                        style={styles.avatar}
                    />
                    <View style={styles.info}>
                        <Text variant="titleSmall" style={styles.name} numberOfLines={1}>
                            {vendor.name || 'Vendor'}
                        </Text>
                        <Text variant="labelSmall" style={styles.email} numberOfLines={1}>
                            {vendor.email}
                        </Text>
                        {vendor.phone ? (
                            <Text variant="labelSmall" style={styles.phone} numberOfLines={1}>
                                {vendor.phone}
                            </Text>
                        ) : null}
                    </View>

                    <Button
                        mode="outlined"
                        compact
                        onPress={() => onChat(vendor)}
                        style={styles.chatBtn}
                        icon="message-outline"
                        labelStyle={{ fontSize: 11 }}
                    >
                        Chat
                    </Button>

                    <Menu
                        visible={menuVisible}
                        onDismiss={() => setMenuVisible(false)}
                        anchor={
                            <IconButton
                                icon="dots-vertical"
                                size={20}
                                onPress={() => setMenuVisible(true)}
                                style={styles.menuAnchor}
                            />
                        }
                    >
                        <Menu.Item
                            leadingIcon="account-remove-outline"
                            onPress={() => {
                                setMenuVisible(false);
                                onRemoveVendor(vendor);
                            }}
                            title="Unapprove Vendor"
                        />
                        <Menu.Item
                            leadingIcon="delete-outline"
                            onPress={() => {
                                setMenuVisible(false);
                                onDeleteVendorPermanently(vendor);
                            }}
                            title="Delete Account"
                            titleStyle={{ color: '#EF4444' }}
                        />
                    </Menu>
                </View>
            </Card.Content>
        </Card>
    );
});

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInner: {
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        backgroundColor: '#ECFDF5',
    },
    info: {
        flex: 1,
        marginLeft: 10,
    },
    name: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    email: {
        color: '#64748B',
    },
    phone: {
        color: '#94A3B8',
        marginTop: 1,
    },
    chatBtn: {
        borderColor: '#6366F1',
        borderRadius: 8,
        marginRight: 2,
    },
    menuAnchor: {
        margin: 0,
    },
});
