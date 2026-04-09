import * as React from 'react';
import { useMemo, memo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Text, Card, Button, Avatar, IconButton, Searchbar, Surface, Snackbar, Chip } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { RootStackParamList, User } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type AssignVendorRouteProp = RouteProp<RootStackParamList, 'AssignVendor'>;

const AnyFlashList = FlashList as any;

const VendorItem = memo(({ item, onAssign, isLoading, isAssigned }: { item: User, onAssign: (vendorId: string) => void, isLoading: boolean, isAssigned: boolean }) => (
    <Card style={[styles.vendorCard, isAssigned && { opacity: 0.8, backgroundColor: '#F8FAFC' }]} elevation={1}>
        <Card.Content style={styles.cardContent}>
            <View style={styles.vendorInfo}>
                <Avatar.Text
                    size={48}
                    label={item.name?.substring(0, 2).toUpperCase() || 'V'}
                    style={styles.avatar}
                />
                <View style={styles.vendorTextContainer}>
                    <Text variant="titleMedium" style={styles.vendorName}>{item.name}</Text>
                    <Text variant="labelSmall" style={styles.vendorEmail}>{item.email}</Text>
                    <View style={styles.ratingRow}>
                        <IconButton icon="star" iconColor="#F59E0B" size={14} style={{ margin: 0, padding: 0 }} />
                        <Text variant="labelSmall" style={styles.ratingText}>4.9 (Verified)</Text>
                    </View>
                </View>
            </View>
            {!isAssigned && (
                <Button 
                    mode="contained" 
                    onPress={() => onAssign(item.id!)}
                    loading={isLoading}
                    disabled={isLoading}
                    style={styles.assignBtn}
                    labelStyle={{ fontSize: 12 }}
                >
                    Assign
                </Button>
            )}
        </Card.Content>
    </Card>
));

const AssignVendorScreen: React.FC = () => {
    const route = useRoute<AssignVendorRouteProp>();
    const navigation = useNavigation();
    const jobId = route.params?.jobId;
    const { getApprovedVendors } = useAuth();
    const { assignVendor, getJobById } = useJobs();

    const [vendors, setVendors] = React.useState<User[]>([]);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [snackbarVisible, setSnackbarVisible] = React.useState(false);
    const [snackbarMessage, setSnackbarMessage] = React.useState('');
    const navigationTimeoutRef = React.useRef<any>(null);

    const job = jobId ? getJobById(jobId) : undefined;

    React.useEffect(() => {
        getApprovedVendors().then(setVendors);
    }, [getApprovedVendors]);

    const filteredVendors = useMemo(() => vendors.filter(v =>
        (v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.email?.toLowerCase().includes(searchQuery.toLowerCase())) && v.id
    ), [vendors, searchQuery]);

    const handleAssign = useCallback(async (vendorId: string) => {
        if (!jobId) return;
        setIsLoading(true);
        try {
            await assignVendor(jobId, vendorId);
            setSnackbarMessage('Work assigned successfully!');
            setSnackbarVisible(true);
            navigationTimeoutRef.current = setTimeout(() => {
                navigation.goBack();
            }, 1500);
        } catch (error: any) {
            setSnackbarMessage(error.message || 'Failed to assign vendor');
            setSnackbarVisible(true);
        } finally {
            setIsLoading(false);
        }
    }, [jobId, assignVendor, navigation]);

    React.useEffect(() => {
        return () => {
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, []);

    if (!jobId) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <IconButton icon="chevron-left" size={24} onPress={() => navigation.goBack()} />
                    <Text variant="titleLarge" style={styles.title}>Assign Vendor</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text variant="bodyLarge">Missing job information.</Text>
                    <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
                        Go back
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton icon="chevron-left" size={24} onPress={() => navigation.goBack()} />
                <Text variant="titleLarge" style={styles.title}>{job?.vendorId ? 'Reassign Vendor' : 'Assign Vendor'}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.jobInfo}>
                <Surface style={styles.jobChip} elevation={1}>
                    <Text variant="labelSmall" style={styles.jobLabel}>TARGET JOB</Text>
                    <Text variant="titleMedium" style={styles.jobAddress} numberOfLines={1}>{job?.address || 'Loading...'}</Text>
                    {job?.vendor && (
                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                            <Text variant="labelSmall" style={{ color: '#64748B' }}>CURRENTLY: </Text>
                            <Chip compact style={{ backgroundColor: '#F1F5F9' }} textStyle={{ color: '#475569', fontSize: 10 }}>{job.vendor.name}</Chip>
                        </View>
                    )}
                </Surface>
            </View>

            <Searchbar
                placeholder="Search verified vendors..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
                elevation={1}
            />

            <View style={{ flex: 1 }}>
                <AnyFlashList
                    data={filteredVendors}
                    keyExtractor={(item: any) => item.id!}
                    contentContainerStyle={styles.listContent}
                    estimatedItemSize={100}
                    renderItem={({ item }: any) => (
                        <View>
                            <VendorItem 
                                item={item} 
                                onAssign={handleAssign} 
                                isLoading={isLoading} 
                                isAssigned={job?.vendorId === item.id}
                            />
                            {job?.vendorId === item.id && (
                                <View style={styles.currentBadgeOverlay}>
                                    <Chip icon="check-circle" style={styles.currentChip} textStyle={styles.currentChipText}>CURRENT ASSIGNMENT</Chip>
                                </View>
                            )}
                        </View>
                    )}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyBox}>
                            <IconButton icon="account-search-outline" size={48} iconColor="#E2E8F0" />
                            <Text variant="bodyLarge" style={styles.emptyText}>No verified vendors found.</Text>
                        </View>
                    )}
                />
            </View>

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
        paddingHorizontal: 4,
        paddingVertical: 8,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerSpacer: {
        width: 40,
    },
    title: {
        flex: 1,
        fontWeight: '900',
        color: '#1E293B',
        textAlign: 'center',
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
        paddingVertical: 8,
    },
    avatar: {
        backgroundColor: '#EEF2FF',
    },
    vendorInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    vendorTextContainer: {
        flex: 1,
        marginLeft: 12,
    },
    vendorName: {
        fontWeight: 'bold',
        color: '#1E293B',
        fontSize: 14,
    },
    vendorEmail: {
        color: '#64748B',
        fontSize: 12,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginLeft: -8,
    },
    ratingText: {
        color: '#64748B',
        fontSize: 11,
    },
    assignBtn: {
        borderRadius: 8,
        minWidth: 80,
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
    currentBadgeOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    currentChip: {
        backgroundColor: '#EEF2FF',
        height: 24,
    },
    currentChipText: {
        color: '#6366F1',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default AssignVendorScreen;
