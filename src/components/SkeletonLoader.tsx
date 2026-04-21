import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import { useReducedMotion } from 'react-native-reanimated';
import { Skeleton } from 'moti/build/skeleton/native';

const { width } = Dimensions.get('window');

interface SkeletonLoaderProps {
    type?: 'job-card' | 'profile' | 'stat-card';
}

/**
 * SkeletonLoader provides a shimmering placeholder while data is loading.
 * This gives the app a "live" feel and maintains the layout structure.
 */
export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ type = 'job-card' }) => {
    const colorMode = 'light'; // Can be linked to theme context later
    const reducedMotion = useReducedMotion();

    if (type === 'stat-card') {
        return (
            <MotiView
                from={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ loop: true, duration: 1000, type: 'timing' }}
                style={styles.statCard}
                reducedMotion={reducedMotion}
            >
                <Skeleton colorMode={colorMode} width="60%" height={20} />
                <View style={{ height: 10 }} />
                <Skeleton colorMode={colorMode} width="40%" height={30} />
            </MotiView>
        );
    }

    // Default: job-card
    return (
        <MotiView
            from={{ opacity: 0.5, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500 }}
            style={styles.jobCard}
            reducedMotion={reducedMotion}
        >
            <View style={styles.row}>
                <Skeleton colorMode={colorMode} radius="round" width={50} height={50} />
                <View style={styles.textContainer}>
                    <Skeleton colorMode={colorMode} width="80%" height={20} />
                    <View style={{ height: 8 }} />
                    <Skeleton colorMode={colorMode} width="50%" height={15} />
                </View>
            </View>
            <View style={styles.divider} />
            <Skeleton colorMode={colorMode} width="100%" height={15} />
            <View style={{ height: 8 }} />
            <Skeleton colorMode={colorMode} width="90%" height={15} />
        </MotiView>
    );
};

export const JobSkeleton = () => <SkeletonLoader type="job-card" />;
export const DashboardStatsSkeleton = () => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 }}>
        <SkeletonLoader type="stat-card" />
        <SkeletonLoader type="stat-card" />
    </View>
);

const styles = StyleSheet.create({
    jobCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        width: (width - 48) / 2,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    textContainer: {
        marginLeft: 12,
        flex: 1,
    },
    divider: {
        height: 1,
        backgroundColor: '#f5f5f5',
        marginVertical: 12,
    },
});
