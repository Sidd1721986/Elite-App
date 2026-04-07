import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { Surface } from 'react-native-paper';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: ViewStyle;
}

const SkeletonItem: React.FC<SkeletonProps> = ({ width = '100%', height = 20, borderRadius = 4, style }) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const pulse = Animated.sequence([
            Animated.timing(opacity, {
                toValue: 0.7,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0.3,
                duration: 800,
                useNativeDriver: true,
            }),
        ]);

        Animated.loop(pulse).start();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor: '#E2E8F0',
                    opacity,
                },
                style,
            ]}
        />
    );
};

export const JobSkeleton = () => (
    <Surface style={styles.card} elevation={1}>
        <View style={styles.row}>
            <SkeletonItem width={50} height={50} borderRadius={12} style={{ marginRight: 16 }} />
            <View style={{ flex: 1 }}>
                <SkeletonItem width="60%" height={16} style={{ marginBottom: 8 }} />
                <SkeletonItem width="40%" height={12} />
            </View>
        </View>
        <View style={{ marginTop: 16 }}>
            <SkeletonItem width="100%" height={40} borderRadius={8} />
        </View>
    </Surface>
);

export const DashboardStatsSkeleton = () => (
    <View style={styles.statsRow}>
        <View style={styles.statItem}>
            <SkeletonItem width={40} height={24} style={{ marginBottom: 4 }} />
            <SkeletonItem width={60} height={10} />
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
            <SkeletonItem width={40} height={24} style={{ marginBottom: 4 }} />
            <SkeletonItem width={60} height={10} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
        marginHorizontal: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 30,
        backgroundColor: '#F1F5F9',
    },
});

export default SkeletonItem;
