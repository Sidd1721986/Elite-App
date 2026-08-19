import * as React from 'react';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import SignupScreen from './SignupScreen';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'VendorSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

// Business details (address, phone) are collected on the vendor profile after
// approval instead of up front.
const VendorSignupScreen: React.FC<Props> = ({ navigation }) => (
    <SignupScreen
        role={UserRole.VENDOR}
        title="Vendor Signup"
        subtitle="Create your account to offer services"
        submitLabel="Create Vendor Account"
        successMessage="Account created! Please wait for Admin approval."
        successDelayMs={2000}
        testIDPrefix="vendor_signup"
        navigation={navigation}
    />
);

export default VendorSignupScreen;
