import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, IconButton, Surface, Divider, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIVACY_POLICY_URL, SUPPORT_URL } from '../config/appConfig';
import { openExternalUrl } from '../utils/openExternalUrl';

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
                    <Text variant="titleMedium" style={styles.lead}>
                        The official privacy policy is published on our website so it always matches
                        what we submit to the App Store and Google Play.
                    </Text>
                    <Divider style={styles.divider} />
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        We collect account details (name, email, phone, address), job and assignment
                        information, in-app messages and attachments you send in connection with jobs,
                        and photos or files you upload. We use this data to run the platform, connect
                        customers and vendors, and provide support. You can deactivate your account
                        from Account details when signed in; some records may be retained where the law
                        requires.
                    </Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        The full policy covers retention, security, international transfers, and your
                        choices. Open the link below for the complete text (same URL used in store
                        listings).
                    </Text>
                    <Button
                        mode="contained"
                        icon="open-in-new"
                        onPress={() => void openExternalUrl(PRIVACY_POLICY_URL)}
                        style={styles.button}
                    >
                        Open full privacy policy
                    </Button>
                    <Button
                        mode="outlined"
                        icon="lifebuoy"
                        onPress={() => void openExternalUrl(SUPPORT_URL)}
                        style={styles.button}
                    >
                        Support &amp; safety reporting
                    </Button>
                </Surface>

                <Text variant="labelSmall" style={styles.footerText}>
                    If a link does not open, check that your production API URL is configured in
                    src/config/env.ts (see env.example.ts).
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
    contentCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
    },
    lead: {
        color: '#1E293B',
        fontWeight: '700',
        marginBottom: 8,
    },
    bodyText: {
        color: '#475569',
        lineHeight: 22,
        marginBottom: 16,
    },
    divider: {
        marginVertical: 16,
        backgroundColor: '#F1F5F9',
    },
    button: {
        marginTop: 8,
    },
    footerText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginBottom: 40,
    },
});

export default PrivacyPolicyScreen;
