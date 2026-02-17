import * as React from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface, IconButton, List } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const AdminDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigation = useNavigation<NavigationProp>();

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <IconButton
                    icon="logout"
                    iconColor="#D32F2F"
                    onPress={handleLogout}
                />
            ),
        });
    }, [navigation]);

    const handleLogout = async () => {
        await logout();
    };

    const stats = [
        { label: 'Total Users', value: '124', icon: 'account-group', color: '#2196F3' },
        { label: 'Active Jobs', value: '18', icon: 'wrench', color: '#4CAF50' },
        { label: 'Pending Quotes', value: '5', icon: 'file-document-edit', color: '#FF9800' },
        { label: 'Revenue', value: '$12.4k', icon: 'currency-usd', color: '#9C27B0' },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                <Surface style={styles.header} elevation={1}>
                    <View style={styles.profileRow}>
                        <Avatar.Icon size={60} icon="shield-account" style={styles.avatar} />
                        <View style={styles.profileText}>
                            <Text variant="headlineSmall" style={styles.welcomeText}>System Admin</Text>
                            <Text variant="bodyMedium" style={styles.emailText}>{user?.email}</Text>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        {stats.map((stat, index) => (
                            <View key={index} style={styles.statItem}>
                                <Avatar.Icon size={32} icon={stat.icon} style={{ backgroundColor: stat.color + '20' }} color={stat.color} />
                                <View style={{ marginLeft: 8 }}>
                                    <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{stat.value}</Text>
                                    <Text variant="labelSmall" style={{ color: '#666' }}>{stat.label}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </Surface>

                <View style={styles.section}>
                    <Text variant="titleLarge" style={styles.sectionTitle}>Dashboard Controllers</Text>

                    <Card style={styles.controllerCard} onPress={() => navigation.navigate('AdminDashboard')}>
                        <Card.Content style={styles.cardContent}>
                            <Surface style={[styles.iconSurface, { backgroundColor: '#E1F5FE' }]} elevation={0}>
                                <IconButton icon="shield-crown" iconColor="#0288D1" size={28} />
                            </Surface>
                            <View style={styles.cardText}>
                                <Text variant="titleMedium" style={styles.cardTitle}>Admin Controls</Text>
                                <Text variant="bodySmall" style={styles.cardSub}>Manage permissions & roles</Text>
                            </View>
                            <IconButton icon="chevron-right" />
                        </Card.Content>
                    </Card>

                    <Card style={styles.controllerCard} onPress={() => navigation.navigate('VendorDashboard')}>
                        <Card.Content style={styles.cardContent}>
                            <Surface style={[styles.iconSurface, { backgroundColor: '#FFF3E0' }]} elevation={0}>
                                <IconButton icon="store" iconColor="#EF6C00" size={28} />
                            </Surface>
                            <View style={styles.cardText}>
                                <Text variant="titleMedium" style={styles.cardTitle}>Vendor Portal View</Text>
                                <Text variant="bodySmall" style={styles.cardSub}>Monitor vendor activities</Text>
                            </View>
                            <IconButton icon="chevron-right" />
                        </Card.Content>
                    </Card>

                    <Card style={styles.controllerCard} onPress={() => navigation.navigate('CustomerDashboard')}>
                        <Card.Content style={styles.cardContent}>
                            <Surface style={[styles.iconSurface, { backgroundColor: '#E8F5E9' }]} elevation={0}>
                                <IconButton icon="account-tie" iconColor="#2E7D32" size={28} />
                            </Surface>
                            <View style={styles.cardText}>
                                <Text variant="titleMedium" style={styles.cardTitle}>Customer View</Text>
                                <Text variant="bodySmall" style={styles.cardSub}>Inspect user experience</Text>
                            </View>
                            <IconButton icon="chevron-right" />
                        </Card.Content>
                    </Card>
                </View>

                <View style={styles.section}>
                    <Text variant="titleLarge" style={styles.sectionTitle}>System Logs</Text>
                    <Card style={styles.logsCard}>
                        <List.Item
                            title="New Vendor Registered"
                            description="H-Tech Solutuions joined • 2m ago"
                            left={props => <List.Icon {...props} icon="account-plus-outline" color="#2E7D32" />}
                        />
                        <Divider />
                        <List.Item
                            title="Job Request Multi-Match"
                            description="Leakage fix sent to 5 plumbers"
                            left={props => <List.Icon {...props} icon="lightning-bolt" color="#FBC02D" />}
                        />
                        <Divider />
                        <List.Item
                            title="Database Backup"
                            description="Successful automatic backup • 1h ago"
                            left={props => <List.Icon {...props} icon="database-check" color="#0288D1" />}
                        />
                    </Card>
                </View>

                <Button
                    mode="text"
                    onPress={handleLogout}
                    textColor="#D32F2F"
                    style={styles.bottomLogout}
                >
                    Terminate Session
                </Button>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F7FB',
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
    avatar: {
        backgroundColor: '#F0F4F8',
    },
    profileText: {
        marginLeft: 16,
    },
    welcomeText: {
        fontWeight: '900',
        color: '#1A202C',
    },
    emailText: {
        color: '#718096',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '45%',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#2D3748',
        marginBottom: 16,
    },
    controllerCard: {
        marginBottom: 12,
        borderRadius: 16,
        backgroundColor: '#fff',
        elevation: 1,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconSurface: {
        width: 56,
        height: 56,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardText: {
        flex: 1,
        marginLeft: 16,
    },
    cardTitle: {
        fontWeight: 'bold',
        color: '#2D3748',
    },
    cardSub: {
        color: '#A0AEC0',
    },
    logsCard: {
        borderRadius: 16,
        backgroundColor: '#fff',
        paddingVertical: 8,
    },
    bottomLogout: {
        marginVertical: 32,
    },
});

export default AdminDashboard;
