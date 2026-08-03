import * as React from 'react';
import { Banner } from 'react-native-paper';
import { useJobs } from '../context/JobContext';

/**
 * Surfaces the JobContext `error` (a failed load/mutation) that was previously swallowed —
 * dashboards showed a silent empty state instead. Reads context directly so wiring it into a
 * screen is a single <JobErrorBanner /> with no per-screen state. Offers Retry + Dismiss.
 */
export const JobErrorBanner: React.FC = () => {
    const { error, refreshJobs } = useJobs();
    const [dismissed, setDismissed] = React.useState(false);

    // A new error re-shows the banner even if the user dismissed a previous one.
    React.useEffect(() => {
        if (error) { setDismissed(false); }
    }, [error]);

    return (
        <Banner
            visible={!!error && !dismissed}
            icon="alert-circle-outline"
            actions={[
                {
                    label: 'Retry',
                    onPress: () => { setDismissed(true); void refreshJobs(); },
                },
                {
                    label: 'Dismiss',
                    onPress: () => setDismissed(true),
                },
            ]}
        >
            {error ?? ''}
        </Banner>
    );
};
