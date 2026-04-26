import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text, IconButton, Surface, Button, List } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUPPORT_URL } from '../config/appConfig';
import { openExternalUrl } from '../utils/openExternalUrl';

const CONTACT_PHONE = '+19044311127';
const CONTACT_PHONE_DISPLAY = '(904) 431-1127';

const ContactSupportScreen: React.FC = () => {
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
                <Text variant="titleLarge" style={styles.headerTitle}>Help &amp; Support</Text>
                <View style={{ width: 48 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Surface style={styles.promoCard} elevation={2}>
                    <IconButton icon="message-question-outline" iconColor="#6366F1" size={48} style={styles.promoIcon} />
                    <Text variant="headlineSmall" style={styles.promoTitle}>How can we help?</Text>
                    <Text variant="bodyMedium" style={styles.promoSubtitle}>
                        Account issues, job questions, and safety reports all go through the same
                        support channel so we can respond consistently.
                    </Text>
                </Surface>

                <Surface style={styles.primaryCard} elevation={1}>
                    <Text variant="titleMedium" style={styles.cardTitle}>Contact &amp; safety reporting</Text>
                    <Text variant="bodyMedium" style={styles.cardBody}>
                        Reach us directly by phone or text, or open our support page for email
                        and guidance on reporting misuse of chat or job features.
                    </Text>
                    <View style={styles.phoneRow}>
                        <Button
                            mode="contained"
                            icon="phone"
                            onPress={() => void Linking.openURL(`tel:${CONTACT_PHONE}`)}
                            style={[styles.phoneBtn, { marginRight: 8 }]}
                        >
                            {CONTACT_PHONE_DISPLAY}
                        </Button>
                        <Button
                            mode="outlined"
                            icon="message-text"
                            onPress={() => void Linking.openURL(`sms:${CONTACT_PHONE}`)}
                            style={styles.phoneBtn}
                        >
                            Text us
                        </Button>
                    </View>
                    <Button
                        mode="text"
                        icon="open-in-new"
                        onPress={() => void openExternalUrl(SUPPORT_URL)}
                        style={styles.supportLinkBtn}
                    >
                        Open support page
                    </Button>
                </Surface>

                <Surface style={styles.faqSection} elevation={0}>
                    <Text variant="titleLarge" style={styles.faqTitle}>Common topics</Text>

                    <List.AccordionGroup>
                        <List.Accordion title="How do I request a service?" id="1">
                            <List.Item
                                title="Use the new request or add flow on your home dashboard to describe the work you need."
                                titleNumberOfLines={4}
                            />
                        </List.Accordion>
                        <List.Accordion title="How are payments handled?" id="2">
                            <List.Item
                                title="The app helps coordinate jobs and invoicing status. Unless we clearly offer in-app payment for a transaction, payment terms are between you and the other party (for example customer and vendor)."
                                titleNumberOfLines={6}
                            />
                        </List.Accordion>
                        <List.Accordion title="How do I deactivate my account?" id="3">
                            <List.Item
                                title="Signed-in users can use Account details → Deactivate account. This marks your account inactive; some records may be kept where required by law."
                                titleNumberOfLines={5}
                            />
                        </List.Accordion>
                        <List.Accordion title="Someone behaved inappropriately in chat" id="4">
                            <List.Item
                                title="Use the support page and email us with a short description and job context. We review reports under our Terms of Service."
                                titleNumberOfLines={5}
                            />
                        </List.Accordion>
                    </List.AccordionGroup>
                </Surface>

                <Text variant="labelSmall" style={styles.footerText}>
                    Response times vary; we aim to reply within a few business days.
                </Text>
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
    primaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 28,
    },
    cardTitle: {
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 8,
    },
    cardBody: {
        color: '#64748B',
        marginBottom: 16,
        lineHeight: 20,
    },
    primaryBtn: {
        borderRadius: 12,
    },
    phoneRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    phoneBtn: {
        flex: 1,
        borderRadius: 12,
    },
    supportLinkBtn: {
        marginTop: 4,
        alignSelf: 'flex-start',
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
    },
});

export default ContactSupportScreen;
