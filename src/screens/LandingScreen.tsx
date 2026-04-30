import * as React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, UserRole } from '../types/types';
import AppLogo from '../components/AppLogo';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

type LandingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Landing'>;

interface Props {
    navigation: LandingScreenNavigationProp;
}

const LandingScreen: React.FC<Props> = ({ navigation }) => {
    const handleRoleSelect = (role: UserRole) => {
        navigation.navigate('Login', { initialRole: role });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.header}>
                    <AppLogo size={140} />
                    <View style={styles.brandContainer}>
                        <Text variant="headlineMedium" style={styles.brandTitle}>
                            <Text style={styles.brandElite}>Elite</Text>
                            <Text style={styles.brandHome}> Home Services</Text>
                        </Text>
                        <Text variant="labelMedium" style={styles.brandSubtitle}>
                            Premium Services. Seamless Experience.
                        </Text>
                    </View>
                </View>

                <View style={styles.introSection}>
                    <Text style={styles.introText}>Welcome to your service dashboard. Choose your portal to continue.</Text>
                </View>

                <View style={styles.buttonContainer}>
                    <RoleButton
                        label="Admin"
                        icon="shield-check-outline"
                        onPress={() => handleRoleSelect(UserRole.ADMIN)}
                        testID="role_btn_admin"
                    />

                    <RoleButton
                        label="Vendor"
                        icon="account-wrench-outline"
                        onPress={() => handleRoleSelect(UserRole.VENDOR)}
                        testID="role_btn_vendor"
                    />

                    <RoleButton
                        label="User"
                        icon="account-outline"
                        onPress={() => handleRoleSelect(UserRole.CUSTOMER)}
                        testID="role_btn_user"
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

interface RoleButtonProps {
    label: string;
    icon: string;
    onPress: () => void;
    testID?: string;
}

const RoleButton: React.FC<RoleButtonProps> = ({ label, icon, onPress, testID }) => (
    <Pressable
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
            styles.roleButton,
            { opacity: pressed ? 0.7 : 1, backgroundColor: pressed ? '#EEF2FF' : '#FFFFFF' },
        ]}
    >
        <View style={styles.roleButtonInner}>
            <MaterialCommunityIcons name={icon} size={28} color="#6366F1" style={styles.buttonIcon} />
            <Text style={styles.roleButtonText}>{label}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#C7D2FE" />
    </Pressable>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FCFDFF', // Very clean white
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 40,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 32,
    },
    brandContainer: {
        marginTop: 12,
        alignItems: 'center',
    },
    brandTitle: {
        fontWeight: '900',
        fontSize: 34,
        letterSpacing: -1.5,
        textAlign: 'center',
    },
    brandElite: {
        color: '#6366F1',
    },
    brandHome: {
        color: '#1E293B',
    },
    brandSubtitle: {
        color: '#94A3B8',
        marginTop: 6,
        letterSpacing: 3,
        fontWeight: '700',
        fontSize: 11,
    },
    introSection: {
        marginBottom: 48,
        paddingHorizontal: 20,
    },
    introText: {
        fontSize: 15,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 22,
    },
    buttonContainer: {
        width: '100%',
        maxWidth: 340,
    },
    roleButton: {
        width: '100%',
        height: 72,
        borderRadius: 36, // Fully rounded sides
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        // Subtle soft shadow
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
        elevation: 1,
    },
    roleButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    buttonIcon: {
        marginRight: 16,
    },
    roleButtonText: {
        color: '#1E293B',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default LandingScreen;
