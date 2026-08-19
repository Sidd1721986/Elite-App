import * as React from 'react';
import { UserRole } from '../types/types';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/types';
import SignupScreen from './SignupScreen';

type SignupScreenNavigationProp = StackNavigationProp<RootStackParamList, 'UserSignup'>;

interface Props {
    navigation: SignupScreenNavigationProp;
}

const UserSignupScreen: React.FC<Props> = ({ navigation }) => (
    <SignupScreen
        role={UserRole.CUSTOMER}
        title="Create Account"
        subtitle="Sign up in seconds to request services"
        submitLabel="Create Account"
        successMessage="Account created! Please log in."
        successDelayMs={1500}
        testIDPrefix="signup"
        navigation={navigation}
    />
);

export default UserSignupScreen;
