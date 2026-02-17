import * as React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface, Chip, IconButton, List } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const VendorDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigation = useNavigation<NavigationProp>();

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <IconButton
                    icon="bell-outline"
                    onPress={() => { }}
                />
            ),
        });
    }, [navigation]);

    const handleLogout = async () => {
        await logout();
    };

    const stats = [
        { label: 'Pending', value: '3', icon: 'clock-outline', color: '#FF9800' },
        { label: 'Active', value: '12', icon: 'hammer-wrench', color: '#2196F3' },
        { label: 'Earnings', value: '$2,850', icon: 'cash', color: '#4CAF50' },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <Surface style={styles.header} elevation={1}>
                    <View style={styles.profileRow}>
                        <Avatar.Image
                            size={64}
                            source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}` }}
                        />
                        <View style={styles.profileText}>
                            <Text variant="headlineSmall" style={styles.vendorName}>{user?.name || 'QuickFix Pro'}</Text>
                            <View style={styles.ratingRow}>
                                <IconButton icon="star" iconColor="#FFD700" size={16} />
                                <Text variant="labelLarge" style={styles.ratingText}>4.9 (128 reviews)</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsContainer}>
                        {stats.map((stat, index) => (
                            <Card key={index} style={styles.statCard}>
                                <Card.Content style={styles.statContent}>
                                    <Avatar.Icon size={32} icon={stat.icon} style={{ backgroundColor: stat.color + '15' }} color={stat.color} />
                                    <Text variant="titleMedium" style={styles.statValue}>{stat.value}</Text>
                                    <Text variant="labelSmall" style={styles.statLabel}>{stat.label}</Text>
                                </Card.Content>
                            </Card>
                        ))}
                    </View>
                </Surface>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text variant="titleLarge" style={styles.sectionTitle}>Active Orders</Text>
                        <Button mode="text" labelStyle={{ fontSize: 12 }}>View All</Button>
                    </View>

                    {[1, 2].map((i) => (
                        <Card key={i} style={styles.orderCard}>
                            <Card.Content>
                                <View style={styles.orderTop}>
                                    <Text variant="titleMedium" style={styles.orderId}>#JOB-8273{i}</Text>
                                    <Chip compact style={styles.orderChip} textStyle={{ fontSize: 10 }}>URGENT</Chip>
                                </View>
                                <Text variant="bodyMedium" style={styles.orderAddress}>123 Maple Ave, Springfield</Text>
                                <Text variant="bodySmall" numberOfLines={1} style={styles.orderDesc}>Kitchen faucet leaking, requires immediate attention...</Text>

                                <Divider style={styles.orderDivider} />

                                <View style={styles.orderBottom}>
                                    <View style={styles.customerInfo}>
                                        <Avatar.Text size={24} label="JS" />
                                        <Text variant="labelSmall" style={{ marginLeft: 8 }}>John Smith</Text>
                                    </View>
                                    <Button mode="contained-tonal" compact labelStyle={{ fontSize: 11 }}>Update Status</Button>
                                </View>
                            </Card.Content>
                        </Card>
                    ))}
                </View>

                <View style={styles.section}>
                    <Text variant="titleLarge" style={styles.sectionTitle}>Tools & Services</Text>
                    <View style={styles.toolsGrid}>
                        <TouchableOpacity style={styles.toolItem}>
                            <Surface style={[styles.toolIcon, { backgroundColor: '#E3F2FD' }]} elevation={0}>
                                <IconButton icon="package-variant" iconColor="#1976D2" size={28} />
                            </Surface>
                            <Text variant="labelMedium" style={styles.toolLabel}>Inventory</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.toolItem}>
                            <Surface style={[styles.toolIcon, { backgroundColor: '#F3E5F5' }]} elevation={0}>
                                <IconButton icon="chart-areaspline" iconColor="#7B1FA2" size={28} />
                            </Surface>
                            <Text variant="labelMedium" style={styles.toolLabel}>Analytics</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.toolItem}>
                            <Surface style={[styles.toolIcon, { backgroundColor: '#E8F5E9' }]} elevation={0}>
                                <IconButton icon="calendar-check" iconColor="#388E3C" size={28} />
                            </Surface>
                            <Text variant="labelMedium" style={styles.toolLabel}>Schedule</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.toolItem}>
                            <Surface style={[styles.toolIcon, { backgroundColor: '#FFF3E0' }]} elevation={0}>
                                <IconButton icon="account-cog" iconColor="#F57C00" size={28} />
                            </Surface>
                            <Text variant="labelMedium" style={styles.toolLabel}>Settings</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Button
                        mode="contained"
                        icon="logout"
                        onPress={handleLogout}
                        style={styles.logoutBtn}
                        buttonColor="#D32F2F"
                    >
                        Logout
                    </Button>
                    <Text variant="labelSmall" style={styles.versionText}>Vendor Control v2.4.0</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        padding: 24,
        backgroundColor: '#fff',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    profileText: {
        marginLeft: 16,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: -12,
    },
    ratingText: {
        color: '#666',
        marginLeft: -8,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    statCard: {
        width: '31%',
        borderRadius: 16,
        backgroundColor: '#fff',
        elevation: 0,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    statContent: {
        padding: 12,
        alignItems: 'center',
    },
    statValue: {
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        color: '#999',
    },
    section: {
        padding: 20,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#1A1A1A',
    },
    orderCard: {
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: '#fff',
        elevation: 1,
    },
    orderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    orderId: {
        fontWeight: 'bold',
    },
    orderChip: {
        backgroundColor: '#FFEBEE',
    },
    orderAddress: {
        color: '#444',
        marginTop: 4,
    },
    orderDesc: {
        color: '#888',
        marginTop: 2,
    },
    orderDivider: {
        marginVertical: 12,
    },
    orderBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    customerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toolsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    toolItem: {
        width: '22%',
        alignItems: 'center',
        marginBottom: 16,
    },
    toolIcon: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    toolLabel: {
        color: '#444',
    },
    footer: {
        padding: 24,
        alignItems: 'center',
    },
    logoutBtn: {
        width: '100%',
        borderRadius: 12,
        paddingVertical: 4,
    },
    versionText: {
        marginTop: 12,
        color: '#CCC',
    },
});

export default VendorDashboard;
