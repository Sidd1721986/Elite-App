import React from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, Button, Surface, Avatar, Divider, IconButton, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types/types';
import { useJobs } from '../context/JobContext';
import { paymentService } from '../services/paymentService';

type PaymentRouteProp = RouteProp<RootStackParamList, 'Payment'>;

/**
 * Customer payment screen.
 *
 * "Pay" opens a hosted Stripe Checkout page in the browser (POST /payments/jobs/{id}/checkout
 * returns the Stripe URL). The customer pays on Stripe; the job flips to 'Paid' via the
 * checkout.session.completed webhook — never from the client. On returning to this screen we
 * refresh jobs so the Paid state shows. Requires Stripe keys configured on the backend to charge.
 */
const PaymentScreen: React.FC = () => {
    const route = useRoute<PaymentRouteProp>();
    const navigation = useNavigation();
    const { getJobById, refreshJobs } = useJobs();
    const jobId = route.params?.jobId;
    const job = jobId ? getJobById(jobId) : undefined;

    const [paying, setPaying] = React.useState(false);

    // When the user returns from the Stripe browser tab, pull fresh job state so a completed
    // payment (settled by the webhook) reflects as Paid here.
    useFocusEffect(
        React.useCallback(() => {
            void refreshJobs();
        }, [refreshJobs]),
    );

    const isPaid = (job?.paymentStatus ?? 'Unpaid') === 'Paid';
    const amountLabel = job?.contractAmount != null
        ? `$${Number(job.contractAmount).toFixed(2)}`
        : '—';

    const handlePay = async () => {
        if (!jobId) { return; }
        setPaying(true);
        try {
            const { url } = await paymentService.createCheckout(jobId);
            if (!url) { throw new Error('No checkout URL returned.'); }
            const canOpen = await Linking.canOpenURL(url);
            if (!canOpen) { throw new Error('Unable to open the payment page.'); }
            await Linking.openURL(url);
        } catch (e: any) {
            Alert.alert('Payment', e?.message ?? 'Could not start checkout. Please try again.');
        } finally {
            setPaying(false);
        }
    };

    if (!job) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.centered}>
                    <Avatar.Icon size={72} icon="alert-circle-outline" style={{ backgroundColor: '#FEF2F2' }} color="#EF4444" />
                    <Text variant="titleLarge" style={{ marginTop: 16, fontWeight: '900' }}>Job not found</Text>
                    <Button mode="contained" onPress={() => navigation.goBack()} style={{ marginTop: 24, borderRadius: 12 }}>
                        Go Back
                    </Button>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton
                    icon="chevron-left"
                    mode="contained"
                    containerColor="#F1F5F9"
                    size={24}
                    onPress={() => navigation.goBack()}
                />
                <Text variant="titleMedium" style={styles.headerTitle}>Payment</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <Surface style={styles.amountCard} elevation={0}>
                    <Text variant="labelMedium" style={styles.amountLabel}>
                        ORDER #{job.jobNumber}{job.jobSuffix || ''}
                    </Text>
                    <Text variant="displaySmall" style={styles.amountValue}>{amountLabel}</Text>
                    <Text variant="bodyMedium" style={styles.address}>{job.address}</Text>
                    <Chip
                        icon={isPaid ? 'check-circle' : 'clock-outline'}
                        style={[styles.statusChip, { backgroundColor: isPaid ? '#ECFDF5' : '#FFF7ED' }]}
                        textStyle={{ color: isPaid ? '#059669' : '#F97316', fontWeight: '700' }}
                    >
                        {isPaid ? 'Paid' : 'Payment due'}
                    </Chip>
                </Surface>

                <Surface style={styles.infoCard} elevation={0}>
                    <View style={styles.row}>
                        <Avatar.Icon size={44} icon="shield-lock-outline" style={{ backgroundColor: '#EEF2FF' }} color="#6366F1" />
                        <View style={styles.rowText}>
                            <Text variant="titleSmall" style={styles.rowTitle}>Secure checkout</Text>
                            <Text variant="bodySmall" style={styles.rowSub}>
                                Card payment is processed by Stripe. Elite Home Services never sees your card details.
                            </Text>
                        </View>
                    </View>
                    <Divider style={{ marginVertical: 14 }} />
                    <View style={styles.row}>
                        <Avatar.Icon size={44} icon="open-in-new" style={{ backgroundColor: '#F1F5F9' }} color="#64748B" />
                        <View style={styles.rowText}>
                            <Text variant="titleSmall" style={styles.rowTitle}>Opens Stripe</Text>
                            <Text variant="bodySmall" style={styles.rowSub}>
                                Tapping Pay opens Stripe's secure checkout page. Come back to the app when you're done — your payment updates automatically.
                            </Text>
                        </View>
                    </View>
                </Surface>
            </ScrollView>

            <Surface style={styles.footer} elevation={2}>
                <Button
                    mode="contained"
                    icon="credit-card-outline"
                    loading={paying}
                    disabled={isPaid || paying}
                    onPress={handlePay}
                    style={styles.payButton}
                    contentStyle={styles.payButtonContent}
                    labelStyle={styles.payButtonLabel}
                >
                    {isPaid ? 'Already Paid' : `Pay ${amountLabel} with Stripe`}
                </Button>
            </Surface>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    headerTitle: { fontWeight: '800', color: '#0F172A' },
    body: { padding: 24, paddingBottom: 40 },
    amountCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EEF2F6',
    },
    amountLabel: { color: '#94A3B8', letterSpacing: 1, marginBottom: 8 },
    amountValue: { fontWeight: '900', color: '#0F172A' },
    address: { color: '#64748B', marginTop: 6, textAlign: 'center' },
    statusChip: { marginTop: 16 },
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginTop: 20,
        borderWidth: 1,
        borderColor: '#EEF2F6',
    },
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    rowText: { flex: 1, marginLeft: 14 },
    rowTitle: { fontWeight: '800', color: '#0F172A', marginBottom: 2 },
    rowSub: { color: '#64748B', lineHeight: 19 },
    footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#EEF2F6' },
    payButton: { borderRadius: 14, backgroundColor: '#6366F1' },
    payButtonContent: { paddingVertical: 8 },
    payButtonLabel: { fontSize: 16, fontWeight: '800' },
});

export default PaymentScreen;
