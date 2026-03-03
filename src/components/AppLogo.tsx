import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Surface } from 'react-native-paper';

/**
 * In-app logo placeholder. Use this instead of require('../assets/logo.png')
 * so the app runs when the image file is missing.
 */
export const AppLogo: React.FC<{ size?: number; showSurface?: boolean }> = ({
    size = 60,
    showSurface = true,
}) => {
    const content = (
        <View style={[styles.inner, { width: size, height: size }]}>
            <Text style={[styles.letter, { fontSize: size * 0.5 }]}>E</Text>
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
    letter: {
        color: '#FFFFFF',
        fontWeight: '900',
    },
});

export default AppLogo;
