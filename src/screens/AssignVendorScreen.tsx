import * as React from 'react';
import { View, StyleSheet, FlatList, ScrollView } from 'react-native';
import { Text, Card, Button, Avatar, IconButton, Searchbar, Surface, Chip, Snackbar } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList, User } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type AssignVendorRouteProp = RouteProp<RootStackParamList, 'AssignVendor'>;

const AssignVendorScreen: React.FC = () => {
    const route = useRoute<AssignVendorRouteProp>();
    const navigation = useNavigation();
    const { jobId } = route.params;
    const { getApprovedVendors } = useAuth();
    const { assignVendor, getJobById } = useJobs();

    const [vendors, setVendors] = React.useState<User[]>([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');

    const job = getJobById(jobId);

    React.useEffect(() => {
        getApprovedVendors().then(setVendors);
    }, [getApprovedVendors]);

    const filteredVendors = vendors.filter(v =>
        v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAssign = async (vendorId: string) => {
        setIsLoading(true);
        try {
            await assignVendor(jobId, vendorId);
            setSnackbarMessage('Work assigned successfully!');
            setSnackbarVisible(true);
            setTimeout(() => {
                navigation.goBack();
            }, 1500);
        } catch (error: any) {
            setSnackbarMessage(error.message || 'Failed to assign vendor');
            setSnackbarVisible(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton icon="chevron-left" size={24} onPress={() => navigation.goBack()} />
                <Text variant="headlineSmall" style={styles.title}>Assign Vendor</Text>
            </View>

            <View style={styles.jobInfo}>
                <Surface style={styles.jobChip} elevation={1}>
                    <Text variant="labelSmall" style={styles.jobLabel}>TARGET JOB</Text>
                    <Text variant="titleMedium" style={styles.jobAddress} numberOfLines={1}>{job?.address || 'Loading...'}</Text>
                </Surface>
            </View>

            <Searchbar
                placeholder="Search verified vendors..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
                elevation={1}
            />

            <FlatList
                data={filteredVendors}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <Card style={styles.vendorCard} elevation={0}>
                        <Card.Content style={styles.cardContent}>
                            <Avatar.Text
                                size={48}
                                label={item.name?.substring(0, 2).toUpperCase() || 'VX'}
                                style={styles.avatar}
                            />
                            <View style={styles.vendorInfo}>
                                <Text variant="titleMedium" style={styles.vendorName}>{item.name}</Text>
                                <Text variant="bodySmall" style={styles.vendorEmail}>{item.email}</Text>
                                <View style={styles.ratingRow}>
                                    <IconButton icon="star" iconColor="#F59E0B" size={16} style={{ margin: 0 }} />
                                    <Text variant="labelSmall" style={styles.ratingText}>4.9 (Verified)</Text>
                                </View>
                            </View>
                            <Button
                                mode="contained"
                                onPress={() => handleAssign(item.id!)}
                                loading={isLoading}
                                disabled={isLoading}
                                style={styles.assignBtn}
                            >
                                Assign
                            </Button>
                        </Card.Content>
                    </Card>
                )}
                ListEmptyComponent={() => (
                    <View style={styles.emptyBox}>
                        <IconButton icon="account-search-outline" size={48} iconColor="#E2E8F0" />
                        <Text variant="bodyLarge" style={styles.emptyText}>No verified vendors found.</Text>
                    </View>
                )}
            />

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                style={styles.snackbar}
            >
                {snackbarMessage}
            </Snackbar>
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
        paddingTop: 8,
    },
    title: {
        fontWeight: '900',
        color: '#1E293B',
        marginLeft: 8,
    },
    jobInfo: {
        paddingHorizontal: 20,
        marginVertical: 16,
    },
    jobChip: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    jobLabel: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 4,
    },
    jobAddress: {
        color: '#1E293B',
        fontWeight: 'bold',
    },
    searchBar: {
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    vendorCard: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorInfo: {
        flex: 1,
        marginLeft: 16,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    vendorEmail: {
        color: '#64748B',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        marginLeft: -8,
    },
    ratingText: {
        color: '#64748B',
    },
    assignBtn: {
        borderRadius: 8,
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#94A3B8',
    },
    snackbar: {
        borderRadius: 12,
        backgroundColor: '#1E293B',
    },
});

export default AssignVendorScreen;
