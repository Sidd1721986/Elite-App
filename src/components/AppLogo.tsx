import * as React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Surface } from 'react-native-paper';

/**
 * In-app logo component. 
 * Displays the company logo from assets/logo.png
 */
export const AppLogo: React.FC<{ size?: number; showSurface?: boolean }> = ({
    size = 60,
    showSurface = true,
}) => {
    const content = (
        <View style={[styles.inner, { width: size, height: size }]}>
            <Image
                source={require('../../assets/logo.png')}
                style={{ width: size, height: size }}
                resizeMode="contain"
            />
        </View>
    );

    if (showSurface) {
        return (
            <Surface style={[styles.surface, { width: size, height: size }]} elevation={0}>
                {content}
            </Surface>
        );
    }
    return content;
};

const styles = StyleSheet.create({
    surface: {
        borderRadius: 24,
        backgroundColor: 'transparent', // Remove white background
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        overflow: 'hidden', // Clip the inner content perfectly
    },
    surfaceInner: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    inner: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 24, // Match surface radius
    },
});

export default AppLogo;
