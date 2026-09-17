import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { JobStatus } from '../../types/types';

/** Ordered steps a vendor takes from assignment to job completion. */
export const VENDOR_PIPELINE = [
    { status: JobStatus.ASSIGNED,     label: 'Assigned',    short: 'Asgn',  icon: 'account-check-outline',      color: '#6366F1' },
    { status: JobStatus.ACCEPTED,     label: 'Accepted',    short: 'Accpt', icon: 'handshake-outline',           color: '#10B981' },
    { status: JobStatus.REACHED_OUT,  label: 'Reached Out', short: 'Call',  icon: 'phone-forward-outline',       color: '#F59E0B' },
    { status: JobStatus.APPT_SET,     label: 'Appt Set',    short: 'Appt',  icon: 'calendar-check-outline',      color: '#8B5CF6' },
    { status: JobStatus.SALE,         label: 'Sale',        short: 'Sale',  icon: 'cash-check',                  color: '#059669' },
    { status: JobStatus.FOLLOW_UP,    label: 'Follow Up',   short: 'FU',    icon: 'message-reply-text-outline',  color: '#F97316' },
] as const;

export function getPipelineIndex(status: string): number {
    return VENDOR_PIPELINE.findIndex(s => s.status === status);
}

/** Horizontal dot-and-line progress bar showing the vendor's current step. */
export const StatusPipeline: React.FC<{ currentStatus: string }> = React.memo(({ currentStatus }) => {
    const currentIdx = getPipelineIndex(currentStatus);
    const step = currentIdx >= 0 ? VENDOR_PIPELINE[currentIdx] : null;
    return (
        <View>
            <View style={pipelineStyles.track}>
                {VENDOR_PIPELINE.map((s, idx) => {
                    const done    = idx < currentIdx;
                    const current = idx === currentIdx;
                    const dotBg   = done ? '#10B981' : current ? s.color : '#E2E8F0';
                    return (
                        <React.Fragment key={s.status}>
                            {idx > 0 && (
                                <View style={[
                                    pipelineStyles.line,
                                    { backgroundColor: idx <= currentIdx ? (done ? '#10B981' : s.color) : '#E2E8F0' },
                                ]} />
                            )}
                            <View style={[
                                pipelineStyles.dot,
                                { backgroundColor: dotBg, width: current ? 12 : 8, height: current ? 12 : 8, borderRadius: 6 },
                                current && { shadowColor: s.color, shadowOpacity: 0.6, shadowRadius: 4, elevation: 3 },
                            ]} />
                        </React.Fragment>
                    );
                })}
            </View>
            {step && (
                <Text style={[pipelineStyles.label, { color: step.color }]}>
                    {step.label.toUpperCase()}
                </Text>
            )}
        </View>
    );
});

const pipelineStyles = StyleSheet.create({
    track:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 2 },
    line:   { flex: 1, height: 2, marginHorizontal: 2 },
    dot:    { borderRadius: 6 },
    label:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 3 },
});
