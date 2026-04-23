import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Checkbox, Text } from 'react-native-paper';

type Props = {
    agreed: boolean;
    onAgreedChange: (value: boolean) => void;
    onPrivacyPress: () => void;
    onTermsPress: () => void;
};

/**
 * Required consent before account creation (App Store / Play baseline for registered apps).
 */
const LegalConsentFooter: React.FC<Props> = ({
    agreed,
    onAgreedChange,
    onPrivacyPress,
    onTermsPress,
}) => {
    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                <Checkbox.Android
                    status={agreed ? 'checked' : 'unchecked'}
                    onPress={() => onAgreedChange(!agreed)}
                />
                <Text variant="bodySmall" style={styles.text}>
                    I agree to the{' '}
                    <Text style={styles.link} onPress={onTermsPress}>
                        Terms of Service
                    </Text>
                    {' '}and{' '}
                    <Text style={styles.link} onPress={onPrivacyPress}>
                        Privacy Policy
                    </Text>
                    .
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginTop: 8,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    text: {
        flex: 1,
        color: '#475569',
        lineHeight: 20,
        paddingTop: 6,
    },
    link: {
        color: '#6366F1',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});

export default LegalConsentFooter;
