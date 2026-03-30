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
                style={{ width: size * 0.8, height: size * 0.8 }}
                resizeMode="contain"
            />
        </View>
    );

    if (showSurface) {
        return (
            <Surface style={[styles.surface, { width: size + 40, height: size + 40 }]} elevation={2}>
                <View style={styles.surfaceInner}>{content}</View>
            </Surface>
        );
    }
    return content;
};

const styles = StyleSheet.create({
    surface: {
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    surfaceInner: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    inner: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#6366F1',
        borderRadius: 16,
    },
});

export default AppLogo;
