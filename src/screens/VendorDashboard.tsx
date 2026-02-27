import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList, Image, RefreshControl, ScrollView, Platform } from 'react-native';
import { Text, Card, Button, Avatar, Divider, Surface, Chip, IconButton, List } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import { useJobs } from '../context/JobContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Job, JobStatus, Urgency } from '../types/types';
import { SafeAreaView } from 'react-native-safe-area-context';

type NavigationProp = StackNavigationProp<RootStackParamList>;

const VendorDashboard: React.FC = () => {
    const { user, logout } = useAuth();
    const { jobs, refreshJobs } = useJobs();
    const navigation = useNavigation<NavigationProp>();
    const [refreshing, setRefreshing] = React.useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshJobs();
        setRefreshing(false);
    }, [refreshJobs]);

    React.useEffect(() => {
        refreshJobs();
    }, [refreshJobs]);

    const handleLogout = useCallback(async () => {
        await logout();
    }, [logout]);

    const activeJobs = useMemo(() =>
        jobs.filter(j => j.status === JobStatus.ASSIGNED || j.status === JobStatus.ACCEPTED || j.status === JobStatus.SALE),
        [jobs]
    );

    const stats = useMemo(() => [
        { label: 'Active', value: activeJobs.length.toString(), icon: 'hammer-wrench', color: '#6366F1' },
        { label: 'Pending', value: jobs.filter(j => j.status === JobStatus.ASSIGNED).length.toString(), icon: 'clock-outline', color: '#F59E0B' },
        { label: 'Ranking', value: '#3', icon: 'trophy-outline', color: '#10B981' },
    ], [activeJobs.length, jobs]);

    const renderOrderCard = useCallback(({ item: job }: { item: Job }) => (
        <Card
            style={styles.orderCard}
            elevation={0}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
        >
            <Card.Content>
                <View style={styles.orderTop}>
                    <Text variant="labelSmall" style={styles.orderId}>#JOB-{(job.id || '').substring(0, 8).toUpperCase()}</Text>
                    {job.urgency === Urgency.IMMEDIATE && (
                        <Chip compact style={styles.urgentChip} textStyle={styles.urgentText}>IMMEDIATE</Chip>
                    )}
                </View>
                <Text variant="titleMedium" style={styles.orderAddress} numberOfLines={1}>{job.address}</Text>
                <Text variant="bodySmall" numberOfLines={2} style={styles.orderDesc}>{job.description}</Text>

                {(job.contactPhone || job.contactEmail) && (
                    <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                        <IconButton icon="phone-outline" size={14} style={{ margin: 0 }} iconColor="#6366F1" />
                        <Text variant="labelSmall" style={{ color: '#6366F1', fontWeight: 'bold' }}>{job.contactPhone || 'N/A'}</Text>
                        <IconButton icon="email-outline" size={14} style={{ margin: 0, marginLeft: 8 }} iconColor="#94A3B8" />
                        <Text variant="labelSmall" style={{ color: '#64748B', flex: 1 }} numberOfLines={1}>{job.contactEmail || 'N/A'}</Text>
                    </View>
                )}

                <Divider style={styles.orderDivider} />

                <View style={styles.orderBottom}>
                    <View style={styles.customerRow}>
                        <Avatar.Text size={24} label={(job.address || '??').substring(0, 2).toUpperCase()} style={styles.miniAvatar} />
                        <Text variant="labelSmall" style={styles.customerType}>{job.status === JobStatus.ASSIGNED ? 'NEW ASSIGNMENT' : 'ACTIVE PROJECT'}</Text>
                    </View>
                    <Button
                        mode="contained"
                        compact
                        style={[styles.quoteBtn, job.status === JobStatus.ASSIGNED && { backgroundColor: '#F59E0B' }]}
                        labelStyle={{ fontSize: 10, fontWeight: 'bold' }}
                        onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
                    >
                        {job.status === JobStatus.ASSIGNED ? 'ACCEPT JOB' : 'VIEW DETAILS'}
                    </Button>
                </View>
            </Card.Content>
        </Card>
    ), [navigation]);

    const renderHeader = useCallback(() => (
        <View style={styles.headerWrapper}>
            <Surface style={styles.header} elevation={0}>
                <View style={styles.headerTop}>
                    <Surface style={styles.logoBox} elevation={1}>
                        <Image
                            source={require('../assets/logo.png')}
                            style={styles.headerLogo}
                            resizeMode="contain"
                        />
                    </Surface>
                    <IconButton
                        icon="logout"
                        iconColor="#EF4444"
                        mode="contained"
                        containerColor="#FEF2F2"
                        size={20}
                        onPress={handleLogout}
                    />
                </View>

                <View style={styles.profileBox}>
                    <View style={styles.profileInfo}>
                        <Text variant="headlineSmall" style={styles.vendorName}>{user?.name || 'QuickFix Pro'}</Text>
                        <View style={styles.ratingBox}>
                            <IconButton icon="star" iconColor="#F59E0B" size={16} style={{ margin: 0 }} />
                            <Text variant="labelLarge" style={styles.ratingText}>4.9 (128 reviews)</Text>
                        </View>
                    </View>
                    <Avatar.Text
                        size={64}
                        label={user?.name?.substring(0, 2).toUpperCase() || 'VX'}
                        style={styles.mainAvatar}
                    />
                </View>

                <View style={styles.statsRow}>
                    {stats.map((s, i) => (
                        <View key={i} style={styles.statItem}>
                            <IconButton icon={s.icon} iconColor={s.color} size={20} style={{ margin: 0 }} />
                            <View>
                                <Text variant="titleMedium" style={styles.statValue}>{s.value}</Text>
                                <Text variant="labelSmall" style={styles.statLabel}>{s.label}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            </Surface>

            <View style={styles.balanceCard}>
                <Surface style={styles.balanceInner} elevation={2}>
                    <View>
                        <Text variant="labelSmall" style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
                        <Text variant="headlineMedium" style={styles.balanceValue}>$1,240.50</Text>
                    </View>
                    <Button mode="contained" buttonColor="#000" style={styles.payoutBtn}>Payout</Button>
                </Surface>
            </View>
        </View>
    ), [user, handleLogout, stats]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <FlatList
                data={activeJobs}
                keyExtractor={item => item.id}
                renderItem={renderOrderCard}
                ListHeaderComponent={renderHeader}
                initialNumToRender={6}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListHeaderComponentStyle={styles.headerList}
                ListEmptyComponent={() => (
                    <View style={styles.emptyBox}>
                        <IconButton icon="briefcase-variant-off-outline" size={48} iconColor="#E2E8F0" />
                        <Text variant="bodyLarge" style={styles.emptyText}>No available jobs in your area.</Text>
                        <Button mode="text" onPress={onRefresh}>Refresh Feed</Button>
                    </View>
                )}
                contentContainerStyle={styles.listContent}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    headerWrapper: {
        marginBottom: 20,
    },
    header: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        paddingBottom: 40,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    logoBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerLogo: {
        width: 28,
        height: 28,
    },
    profileBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    profileInfo: {
        flex: 1,
    },
    vendorName: {
        fontWeight: '900',
        color: '#1E293B',
        letterSpacing: -0.5,
    },
    ratingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    ratingText: {
        color: '#64748B',
    },
    mainAvatar: {
        backgroundColor: '#6366F1',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statValue: {
        fontWeight: 'bold',
        color: '#1E293B',
        lineHeight: 20,
    },
    statLabel: {
        color: '#94A3B8',
        textTransform: 'uppercase',
        fontSize: 9,
        letterSpacing: 0.5,
    },
    balanceCard: {
        marginTop: -24,
        paddingHorizontal: 24,
    },
    balanceInner: {
        backgroundColor: '#6366F1',
        borderRadius: 24,
        padding: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    balanceLabel: {
        color: '#E0E7FF',
        letterSpacing: 1,
    },
    balanceValue: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
    payoutBtn: {
        borderRadius: 12,
    },
    headerList: {
        marginBottom: 24,
    },
    listContent: {
        paddingBottom: 40,
    },
    orderCard: {
        marginHorizontal: 24,
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    orderTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    orderId: {
        color: '#94A3B8',
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    urgentChip: {
        backgroundColor: '#FEF2F2',
        height: 22,
    },
    urgentText: {
        color: '#EF4444',
        fontSize: 9,
        fontWeight: 'bold',
    },
    orderAddress: {
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 4,
    },
    orderDesc: {
        color: '#64748B',
        lineHeight: 18,
    },
    orderDivider: {
        marginVertical: 16,
        backgroundColor: '#F1F5F9',
    },
    orderBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    customerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    miniAvatar: {
        backgroundColor: '#F1F5F9',
    },
    customerType: {
        color: '#94A3B8',
    },
    quoteBtn: {
        borderRadius: 8,
        backgroundColor: '#1E293B',
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#94A3B8',
        marginTop: 16,
    },
});

export default React.memo(VendorDashboard);
