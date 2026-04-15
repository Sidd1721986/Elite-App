import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, IconButton, Surface, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PrivacyPolicyScreen: React.FC = () => {
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
                <Text variant="titleLarge" style={styles.headerTitle}>Privacy Policy</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.contentCard} elevation={1}>
                    <Text variant="headlineSmall" style={styles.sectionTitle}>1. Introduction</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        Elite Home Services ("we," "us," or "our") respects your privacy and is committed to protecting your personal data. This privacy policy informs you about how we look after your personal data when you use our mobile application and tells you about your privacy rights.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>2. Data We Collect</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
                    </Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Identity Data: Includes first name, last name, and role.</Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Contact Data: Includes email address, phone number, and physical address.</Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Technical Data: Includes internet protocol (IP) address, your login data, and device information.</Text>
                    <Text variant="bodyMedium" style={styles.bulletItem}>• Media Data: Includes photos and images you upload for job documentation or profile settings.</Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>3. How We Use Your Data</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        We use your data to provide, maintain, and improve our services, including processing your service requests, connecting customers with verified vendors, and sharing job-site photos between authorized users (Customers, Vendors, and Administrators) for work verification.
                    </Text>

                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>4. Contact Us</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        If you have any questions about this privacy policy or our privacy practices, please contact us at:
                    </Text>
                    
                    <Surface style={styles.contactPlaceholder} elevation={0}>
                        <Text variant="labelLarge" style={styles.placeholderLabel}>Elite Home Services</Text>
                        <Text variant="bodyMedium" style={styles.placeholderText}>Email: support@elitehomeservices.com</Text>
                        <Text variant="bodyMedium" style={styles.placeholderText}>Phone: (Contact details pending)</Text>
                        <Text variant="bodyMedium" style={styles.placeholderText}>Address: Legal disclosure pending</Text>
                    </Surface>
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
    contactPlaceholder: {
        marginTop: 12,
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
    },
    placeholderLabel: {
        color: '#6366F1',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    placeholderText: {
        color: '#64748B',
        marginBottom: 4,
    },
    footerText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginBottom: 40,
    }
});

export default PrivacyPolicyScreen;
