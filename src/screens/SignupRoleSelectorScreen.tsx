import * as React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import AppLogo from '../components/AppLogo';

type RoleSelectorNavigationProp = StackNavigationProp<RootStackParamList>;

interface Props {
    navigation: RoleSelectorNavigationProp;
}

const SignupRoleSelectorScreen: React.FC<Props> = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <AppLogo size={56} showSurface={false} />
                </View>

                <Text variant="displaySmall" style={styles.title}>
                    Join Us
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                    Choose how you want to use the platform
                </Text>

                <Card style={styles.card} onPress={() => navigation.navigate('UserSignup')}>
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.iconContainer}>
                            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                                <Button icon="account" textColor="#1976D2" contentStyle={styles.cardIcon} children={undefined} />
                            </View>
                        </View>
                        <View style={styles.textContainer}>
                            <Text variant="titleLarge" style={styles.cardTitle}>I am a User</Text>
                            <Text variant="bodyMedium" style={styles.cardDesc}>I need services for my home or business</Text>
                        </View>
                    </Card.Content>
                </Card>

                <Card style={[styles.card, styles.vendorCard]} onPress={() => navigation.navigate('VendorSignup')}>
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.iconContainer}>
                            <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
                                <Button icon="store" textColor="#F57C00" contentStyle={styles.cardIcon} children={undefined} />
                            </View>
                        </View>
                        <View style={styles.textContainer}>
                            <Text variant="titleLarge" style={styles.cardTitle}>I am a Vendor</Text>
                            <Text variant="bodyMedium" style={styles.cardDesc}>I provide specialized technical services</Text>
                        </View>
                    </Card.Content>
                </Card>

                <Button
                    mode="text"
                    onPress={() => navigation.navigate('Login')}
                    style={styles.loginButton}
                >
                    Already have an account? Login
                </Button>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 32,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logo: {
        width: 96,
        height: 96,
        borderRadius: 24,
    },
    title: {
        textAlign: 'center',
        fontWeight: '900',
        marginBottom: 8,
        color: '#1E293B',
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.8,
        color: '#64748B',
    },
    card: {
        marginBottom: 16,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    vendorCard: {
        marginBottom: 32,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    iconContainer: {
        marginRight: 16,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardIcon: {
        marginLeft: 12,
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    cardDesc: {
        color: '#64748B',
        marginTop: 4,
    },
    loginButton: {
        marginTop: 24,
        alignSelf: 'center',
    },
});

export default SignupRoleSelectorScreen;
