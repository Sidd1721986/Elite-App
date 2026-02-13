import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface, Chip } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const VendorDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const navigation = useNavigation<NavigationProp>();

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <Button
                    onPress={handleLogout}
                    mode="text"
                    textColor="#D32F2F"
                    icon="logout"
                >
                    Logout
                </Button>
            ),
        });
    }, [navigation]);

    const handleLogout = async () => {
        await logout();
    };

    return (
        <ScrollView style={styles.container}>
            <Surface style={styles.header}>
                <Avatar.Icon size={64} icon="store" style={styles.avatar} />
                <Text variant="headlineMedium" style={styles.title}>
                    Vendor Dashboard
                </Text>
                <Text variant="bodyLarge">Welcome, {user?.username}!</Text>
                <Text variant="bodyMedium" style={styles.role}>
                    Role: {user?.role}
                </Text>
            </Surface>

            <Card style={styles.infoCard}>
                <Card.Content>
                    <View style={styles.infoHeader}>
                        <Avatar.Icon size={40} icon="store" />
                        <Text variant="titleMedium" style={styles.infoTitle}>
                            Vendor Portal
                        </Text>
                    </View>
                    <Divider style={styles.divider} />
                    <Text variant="bodyMedium">
                        Manage your products, view orders, and track your sales performance.
                    </Text>
                </Card.Content>
            </Card>

            <Text variant="titleLarge" style={styles.sectionTitle}>
                Quick Actions
            </Text>

            <Card style={styles.featureCard}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="package-variant" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Product Management</Text>
                        <Text variant="bodyMedium">Add, edit, and manage your inventory</Text>
                    </View>
                </Card.Content>
            </Card>

            <Card style={styles.featureCard}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="clipboard-list" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Order Management</Text>
                        <Text variant="bodyMedium">View and process customer orders</Text>
                    </View>
                </Card.Content>
            </Card>

            <Card style={styles.featureCard}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="chart-line" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Sales Analytics</Text>
                        <Text variant="bodyMedium">Track performance and insights</Text>
                    </View>
                </Card.Content>
            </Card>

            <Card style={styles.featureCard}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="cog" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Store Settings</Text>
                        <Text variant="bodyMedium">Manage profile and preferences</Text>
                    </View>
                </Card.Content>
            </Card>

            <Text variant="titleLarge" style={styles.sectionTitle}>
                Statistics
            </Text>

            <View style={styles.statsContainer}>
                <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                        <Text variant="headlineMedium" style={styles.statNumber}>
                            0
                        </Text>
                        <Text variant="bodyMedium">Products</Text>
                    </Card.Content>
                </Card>

                <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                        <Text variant="headlineMedium" style={styles.statNumber}>
                            0
                        </Text>
                        <Text variant="bodyMedium">Orders</Text>
                    </Card.Content>
                </Card>

                <Card style={styles.statCard}>
                    <Card.Content style={styles.statContent}>
                        <Text variant="headlineMedium" style={styles.statNumber}>
                            $0
                        </Text>
                        <Text variant="bodyMedium">Revenue</Text>
                    </Card.Content>
                </Card>
            </View>

            <Button
                mode="contained"
                onPress={handleLogout}
                icon="logout"
                style={styles.logoutButton}
                buttonColor="#D32F2F"
            >
                Logout
            </Button>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        padding: 24,
        alignItems: 'center',
        elevation: 2,
    },
    avatar: {
        marginBottom: 16,
        backgroundColor: '#FF9800',
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    role: {
        opacity: 0.7,
        marginTop: 4,
    },
    infoCard: {
        margin: 16,
        marginBottom: 8,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoTitle: {
        marginLeft: 12,
        fontWeight: 'bold',
    },
    divider: {
        marginVertical: 12,
    },
    sectionTitle: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
        fontWeight: 'bold',
    },
    featureCard: {
        marginHorizontal: 16,
        marginBottom: 12,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardIcon: {
        backgroundColor: 'transparent',
    },
    cardText: {
        marginLeft: 16,
        flex: 1,
    },
    statsContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    statCard: {
        flex: 1,
    },
    statContent: {
        alignItems: 'center',
    },
    statNumber: {
        fontWeight: 'bold',
        color: '#FF9800',
    },
    logoutButton: {
        margin: 16,
        marginTop: 24,
        paddingVertical: 6,
    },
});

export default VendorDashboard;
