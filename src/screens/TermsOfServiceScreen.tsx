import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, IconButton, Surface, Divider, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TERMS_OF_SERVICE_URL, SUPPORT_URL } from '../config/appConfig';
import { openExternalUrl } from '../utils/openExternalUrl';

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
                    <Text variant="titleMedium" style={styles.lead}>
                        Official terms are hosted online so they match app store submissions and can be
                        updated when our practices change.
                    </Text>
                    <Divider style={styles.divider} />

                    <Text variant="headlineSmall" style={styles.sectionTitle}>Summary</Text>
                    <Text variant="bodyMedium" style={styles.bodyText}>
                        By using Elite Services you agree to these terms. The Service connects
                        customers with independent vendors; vendors are not our employees. Use
                        messaging and job features lawfully and respectfully. Payment and invoicing
                        arrangements are primarily between the parties unless we state otherwise for
                        a specific feature. You may deactivate your account in the app where that
                        option is available.
                    </Text>

                    <Text variant="bodyMedium" style={styles.bodyText}>
                        Open the link below for the complete Terms of Service, including disclaimers,
                        limitation of liability, and contact information.
                    </Text>

                    <Button
                        mode="contained"
                        icon="open-in-new"
                        onPress={() => void openExternalUrl(TERMS_OF_SERVICE_URL)}
                        style={styles.button}
                    >
                        Open full terms of service
                    </Button>
                    <Button
                        mode="outlined"
                        icon="lifebuoy"
                        onPress={() => void openExternalUrl(SUPPORT_URL)}
                        style={styles.button}
                    >
                        Support
                    </Button>
                </Surface>

                <Text variant="labelSmall" style={styles.footerText}>
                    Configure your production base URL in src/config/env.ts for these links to resolve.
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

export default TermsOfServiceScreen;
