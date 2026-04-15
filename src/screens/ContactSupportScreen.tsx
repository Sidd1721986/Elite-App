import React from 'react';
import { ScrollView, StyleSheet, View, Linking } from 'react-native';
import { Text, IconButton, Surface, Button, List } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ContactSupportScreen: React.FC = () => {
    const navigation = useNavigation();
    
    // Replace with your actual support info
    const supportEmail = "support@elite.com";
    const supportPhone = "+1-800-ELITE-01";

    const handleEmail = () => {
        Linking.openURL(`mailto:${supportEmail}?subject=Support Request - Elite App`);
    };

    const handlePhone = () => {
        Linking.openURL(`tel:${supportPhone}`);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <IconButton
                    icon="arrow-left"
                    onPress={() => navigation.goBack()}
                    containerColor="#FFFFFF"
                    iconColor="#6366F1"
                />
                <Text variant="titleLarge" style={styles.headerTitle}>Help & Support</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.promoCard} elevation={2}>
                    <IconButton icon="message-question-outline" iconColor="#6366F1" size={48} style={styles.promoIcon} />
                    <Text variant="headlineSmall" style={styles.promoTitle}>How can we help?</Text>
                    <Text variant="bodyMedium" style={styles.promoSubtitle}>Our support team is here to assist you with any questions or issues.</Text>
                </Surface>

                <View style={styles.actionGrid}>
                    <Surface style={styles.actionCard} elevation={1}>
                        <IconButton icon="email-outline" iconColor="#6366F1" size={32} />
                        <Text variant="titleMedium" style={styles.actionLabel}>Email us</Text>
                        <Text variant="labelSmall" style={styles.actionValue}>{supportEmail}</Text>
                        <Button mode="contained" onPress={handleEmail} style={styles.actionBtn}>Send Email</Button>
                    </Surface>

                    <Surface style={styles.actionCard} elevation={1}>
                        <IconButton icon="phone-outline" iconColor="#6366F1" size={32} />
                        <Text variant="titleMedium" style={styles.actionLabel}>Call us</Text>
                        <Text variant="labelSmall" style={styles.actionValue}>{supportPhone}</Text>
                        <Button mode="outlined" onPress={handlePhone} style={styles.actionBtn}>Call Now</Button>
                    </Surface>
                </View>

                <Surface style={styles.faqSection} elevation={0}>
                    <Text variant="titleLarge" style={styles.faqTitle}>Frequently Asked Questions</Text>
                    
                    <List.AccordionGroup>
                        <List.Accordion title="How do I book a job?" id="1">
                            <List.Item title="Simply tap the '+' or 'New Request' button on dashboard." titleNumberOfLines={3} />
                        </List.Accordion>
                        <List.Accordion title="Is my payment secure?" id="2">
                            <List.Item title="We use bank-level encryption for all payments." titleNumberOfLines={3} />
                        </List.Accordion>
                        <List.Accordion title="How do I change my role?" id="3">
                            <List.Item title="Roles are fixed upon signup. Contact support for manual changes." titleNumberOfLines={3} />
                        </List.Accordion>
                    </List.AccordionGroup>
                </Surface>

                <Text variant="labelSmall" style={styles.footerText}>Response Time: Usually under 24 hours</Text>
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
    promoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderColor: '#EEF2FF',
        borderWidth: 1,
    },
    promoIcon: {
        backgroundColor: '#F5F3FF',
        marginBottom: 16,
    },
    promoTitle: {
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 8,
    },
    promoSubtitle: {
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
    },
    actionGrid: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 32,
    },
    actionCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
    },
    actionLabel: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4,
    },
    actionValue: {
        color: '#64748B',
        marginBottom: 16,
    },
    actionBtn: {
        width: '100%',
        borderRadius: 12,
    },
    faqSection: {
        backgroundColor: 'transparent',
        marginBottom: 20,
    },
    faqTitle: {
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 16,
        paddingLeft: 8,
    },
    footerText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginBottom: 40,
    }
});

export default ContactSupportScreen;
