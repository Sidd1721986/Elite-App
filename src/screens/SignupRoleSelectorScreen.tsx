import * as React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';

type RoleSelectorNavigationProp = StackNavigationProp<RootStackParamList, 'SignupRoleSelector'>;

interface Props {
    navigation: RoleSelectorNavigationProp;
}

const SignupRoleSelectorScreen: React.FC<Props> = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>

                <Text variant="displaySmall" style={styles.title}>
                    Join Us
                </Text>
                <Text variant="bodyLarge" style={styles.subtitle}>
                    Choose how you want to use the platform
                </Text>

                <Card style={styles.card} onPress={() => navigation.navigate('CustomerSignup')}>
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.iconContainer}>
                            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
                                <Button icon="account-tie" textColor="#1976D2" contentStyle={styles.cardIcon} children={undefined} />
                            </View>
                        </View>
                        <View style={styles.textContainer}>
                            <Text variant="titleLarge" style={styles.cardTitle}>I am a Customer</Text>
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
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 20,
    },
    title: {
        textAlign: 'center',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 40,
        opacity: 0.7,
    },
    card: {
        marginBottom: 16,
        borderRadius: 16,
        backgroundColor: '#fff',
        elevation: 2,
    },
    vendorCard: {
        marginBottom: 32,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
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
        color: '#333',
    },
    cardDesc: {
        color: '#666',
        marginTop: 4,
    },
    loginButton: {
        marginTop: 16,
    },
});

export default SignupRoleSelectorScreen;
