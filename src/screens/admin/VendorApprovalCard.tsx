import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Avatar, Text, Divider, IconButton, Button } from 'react-native-paper';
import { User } from '../../types/types';

interface VendorApprovalCardProps {
    vendor: User;
    onApprove: (id: string) => void;
    onDeny: (id: string) => void;
    onChat: (vendor: User) => void;
}

export const VendorApprovalCard: React.FC<VendorApprovalCardProps> = React.memo(({
    vendor,
    onApprove,
    onDeny,
    onChat,
}) => {
    return (
        <Card style={styles.approvalCard} elevation={0}>
            <Card.Content style={styles.cardInner}>
                <View style={styles.cardHeader}>
                    <Avatar.Text
                        size={44}
                        label={(vendor.name || vendor.email || '??').substring(0, 2).toUpperCase()}
                        style={styles.vendorAvatar}
                    />
                    <View style={styles.vendorInfo}>
                        <Text variant="titleSmall" style={styles.vendorName} numberOfLines={1}>
                            {vendor.name || 'Anonymous Vendor'}
                        </Text>
                        <Text variant="labelSmall" style={styles.vendorEmail} numberOfLines={1}>
                            {vendor.email}
                        </Text>
                    </View>
                    <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                    </View>
                </View>

                <Divider style={styles.cardDivider} />

                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <IconButton icon="map-marker-outline" size={16} style={{ margin: 0 }} />
                        <Text variant="labelSmall" style={styles.detailText} numberOfLines={1}>
                            {vendor.address || 'No Address'}
                        </Text>
                    </View>
                    <View style={styles.detailItem}>
                        <IconButton icon="phone-outline" size={16} style={{ margin: 0 }} />
                        <Text variant="labelSmall" style={styles.detailText} numberOfLines={1}>
                            {vendor.phone || 'No Phone'}
                        </Text>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <Button
                        mode="contained"
                        onPress={() => onApprove(vendor.id || '')}
                        style={styles.approveBtn}
                    >
                        Approve
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={() => onDeny(vendor.id || '')}
                        style={styles.denyBtn}
                        textColor="#EF4444"
                    >
                        Deny
                    </Button>
                    <Button
                        mode="outlined"
                        onPress={() => onChat(vendor)}
                        style={styles.messageBtn}
                        icon="message-outline"
                    >
                        Chat
                    </Button>
                </View>
            </Card.Content>
        </Card>
    );
});

const styles = StyleSheet.create({
    approvalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardInner: {
        padding: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    vendorAvatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorInfo: {
        flex: 1,
        marginLeft: 12,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    vendorEmail: {
        color: '#64748B',
    },
    pendingBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    pendingBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#D97706',
    },
    cardDivider: {
        marginVertical: 10,
        backgroundColor: '#F1F5F9',
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    detailItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailText: {
        color: '#64748B',
        flex: 1,
    },
    cardActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    approveBtn: {
        flex: 1,
        backgroundColor: '#10B981',
        borderRadius: 10,
    },
    denyBtn: {
        flex: 1,
        borderColor: '#EF4444',
        borderRadius: 10,
    },
    messageBtn: {
        borderColor: '#6366F1',
        borderRadius: 10,
    },
});
