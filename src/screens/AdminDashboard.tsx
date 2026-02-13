import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const AdminDashboard: React.FC = () => {
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

    const navigateToDashboard = (screen: keyof RootStackParamList) => {
        navigation.navigate(screen);
    };

    return (
        <ScrollView style={styles.container}>
            <Surface style={styles.header}>
                <Avatar.Icon size={64} icon="shield-account" style={styles.avatar} />
                <Text variant="headlineMedium" style={styles.title}>
                    Admin Dashboard
                </Text>
                <Text variant="bodyLarge">Welcome, {user?.username}!</Text>
                <Text variant="bodyMedium" style={styles.role}>
                    Role: {user?.role}
                </Text>
            </Surface>

            <Card style={styles.infoCard}>
                <Card.Content>
                    <View style={styles.infoHeader}>
                        <Avatar.Icon size={40} icon="lock" />
                        <Text variant="titleMedium" style={styles.infoTitle}>
                            Admin Access
                        </Text>
                    </View>
                    <Divider style={styles.divider} />
                    <Text variant="bodyMedium">
                        As an admin, you have full access to all sections of the application.
                        You can view and manage all user dashboards.
                    </Text>
                </Card.Content>
            </Card>

            <Text variant="titleLarge" style={styles.sectionTitle}>
                Access All Dashboards
            </Text>

            <Card style={styles.dashboardCard} onPress={() => navigateToDashboard('AdminDashboard')}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="shield-crown" color="#9C27B0" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Admin Dashboard</Text>
                        <Text variant="bodyMedium">Manage all users and settings</Text>
                    </View>
                </Card.Content>
            </Card>

            <Card style={styles.dashboardCard} onPress={() => navigateToDashboard('VendorDashboard')}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="store" color="#FF9800" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Vendor Dashboard</Text>
                        <Text variant="bodyMedium">Manage products and orders</Text>
                    </View>
                </Card.Content>
            </Card>

            <Card style={styles.dashboardCard} onPress={() => navigateToDashboard('CustomerDashboard')}>
                <Card.Content style={styles.cardContent}>
                    <Avatar.Icon size={48} icon="cart" color="#4CAF50" style={styles.cardIcon} />
                    <View style={styles.cardText}>
                        <Text variant="titleMedium">Customer Dashboard</Text>
                        <Text variant="bodyMedium">Browse and purchase products</Text>
                    </View>
                </Card.Content>
            </Card>

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
    dashboardCard: {
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
    logoutButton: {
        margin: 16,
        marginTop: 24,
        paddingVertical: 6,
    },
});

export default AdminDashboard;
