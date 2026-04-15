import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, IconButton, Surface, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TermsOfServiceScreen: React.FC = () => {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    onPress={() => navigation.goBack()}
                    containerColor="#FFFFFF"
                    iconColor="#6366F1"
                />
                <Text variant="titleLarge" style={styles.headerTitle}>Terms of Service</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.contentCard} elevation={1}>
                    <Text variant="headlineSmall" style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        By accessing or using the Elite Home Services mobile application, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use the application.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>2. User Accounts</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        To use certain features of the app, you must register for an account. You agree to provide accurate information and are responsible for maintaining the confidentiality of your account credentials.
                    </Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Customers: Responsible for providing accurate service locations and descriptions.</Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Vendors: Responsible for maintaining professional standards and accurate project updates.</Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Admins: Responsible for system oversight and dispute resolution.</Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>3. Service Marketplace</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        Elite Home Services acts as a platform to connect Customers with independent Vendors. We do not provide the physical home services ourselves and are not responsible for the workmanship of third-party vendors, although we facilitate verification and communication.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>4. Payments & Invoicing</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        Services booked through the app are subject to the agreed-upon contract amount. Vendors are responsible for submitting accurate invoices, and Customers agree to pay for services rendered in a timely manner.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>5. Limitation of Liability</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        To the maximum extent permitted by law, Elite Home Services shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the service or the conduct of any user on the platform.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>6. Termination</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users or the business interests of Elite Home Services.
                    </Text>
                </Surface>
                
                <Text variant="labelSmall" style={styles.footerText}>Last Updated: April 2024</Text>
            </ScrollView>
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
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontWeight: '900',
        color: '#1E293B',
    },
    scrollContent: {
        padding: 20,
    },
    contentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#1E293B',
        fontWeight: '800',
        fontSize: 18,
        marginBottom: 12,
    },
    bodyText: {
        color: '#475569',
        lineHeight: 22,
        marginBottom: 16,
    },
    bulletItem: {
        color: '#475569',
        lineHeight: 22,
        marginLeft: 8,
        marginBottom: 4,
    },
    divider: {
        marginVertical: 20,
        backgroundColor: '#F1F5F9',
    },
    footerText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginBottom: 40,
    }
});

export default TermsOfServiceScreen;
