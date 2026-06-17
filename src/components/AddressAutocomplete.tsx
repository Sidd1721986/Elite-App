/**
 * AddressAutocomplete — Street address field with Google Places suggestions.
 *
 * Uses the Places Autocomplete + Place Details REST APIs directly so the
 * suggestion list is absolutely-positioned (floats above the form) and
 * there is no FlatList-inside-ScrollView nesting warning.
 *
 * Usage:
 *   <AddressAutocomplete
 *     label="Street Address"
 *     hasError={submitted && !street}
 *     initialValue={street}
 *     onAddressSelect={({ street, city, zip, state }) => { ... }}
 *   />
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { GOOGLE_PLACES_API_KEY } from '../config/env';

export interface AddressParts {
    street: string;
    city: string;
    zip: string;
    state: string;
}

interface Prediction {
    place_id: string;
    description: string;
}

interface Props {
    label?: string;
    hasError?: boolean;
    initialValue?: string;
    onAddressSelect: (parts: AddressParts) => void;
}

/** Parse Google Place Details address_components into AddressParts. */
function parseComponents(components: any[]): AddressParts {
    const get = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.short_name ?? '';
    const getLong = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name ?? '';

    const street = [get('street_number'), getLong('route')]
        .filter(Boolean)
        .join(' ');
    const city =
        getLong('locality') ||
        getLong('sublocality') ||
        getLong('administrative_area_level_3') ||
        getLong('postal_town');
    const zip = get('postal_code');
    const state = get('administrative_area_level_1');

    return { street, city, zip, state };
}

const AddressAutocomplete: React.FC<Props> = ({
    label = 'Street Address',
    hasError = false,
    initialValue = '',
    onAddressSelect,
}) => {
    const [query, setQuery] = useState(initialValue);
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [focused, setFocused] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep query in sync if parent resets initialValue (e.g. after correction)
    useEffect(() => {
        setQuery(initialValue);
    }, [initialValue]);

    const fetchPredictions = (text: string) => {
        if (debounceRef.current) { clearTimeout(debounceRef.current); }
        if (text.length < 2) { setPredictions([]); return; }

        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const url =
                    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
                    `?input=${encodeURIComponent(text)}` +
                    `&key=${GOOGLE_PLACES_API_KEY}` +
                    `&components=country:us` +
                    `&types=address` +
                    `&language=en`;
                const res = await fetch(url);
                const data = await res.json();
                // A denied/over-quota key returns HTTP 200 with status REQUEST_DENIED /
                // OVER_QUERY_LIMIT and no predictions — don't let that look like "no address found".
                if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                    console.warn('Places autocomplete error:', data.status, data.error_message);
                }
                setPredictions(data.predictions ?? []);
            } catch {
                setPredictions([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    const selectPrediction = async (prediction: Prediction) => {
        setQuery(prediction.description);
        setPredictions([]);
        setLoading(true);
        try {
            const url =
                `https://maps.googleapis.com/maps/api/place/details/json` +
                `?place_id=${prediction.place_id}` +
                `&fields=address_components` +
                `&key=${GOOGLE_PLACES_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            const parts = parseComponents(data.result?.address_components ?? []);
            // Show just the street in the input box
            setQuery(parts.street || prediction.description);
            onAddressSelect(parts);
        } catch {
            onAddressSelect({ street: prediction.description, city: '', zip: '', state: '' });
        } finally {
            setLoading(false);
        }
    };

    const borderColor = hasError ? '#B00020' : focused ? '#6366F1' : '#79747E';
    const labelColor  = hasError ? '#B00020' : focused ? '#6366F1' : '#49454F';
    const borderWidth = focused || hasError ? 2 : 1;

    return (
        <View style={styles.container}>
            {/* Outlined TextInput look */}
            <View style={[styles.inputBox, { borderColor, borderWidth }]}>
                {/* Floating label */}
                <Text style={[styles.label, { color: labelColor }]}>{label}</Text>

                <View style={styles.row}>
                    <TextInput
                        style={styles.input}
                        value={query}
                        onChangeText={(text) => {
                            setQuery(text);
                            fetchPredictions(text);
                        }}
                        onFocus={() => setFocused(true)}
                        onBlur={() => {
                            setFocused(false);
                            // Small delay so tap on suggestion registers first
                            setTimeout(() => setPredictions([]), 150);
                        }}
                        placeholder={focused ? 'e.g. 88 Main St' : ''}
                        placeholderTextColor="#94A3B8"
                        autoCorrect={false}
                        autoComplete="street-address"
                        returnKeyType="next"
                    />
                    {loading && (
                        <ActivityIndicator
                            size="small"
                            color="#6366F1"
                            style={{ marginRight: 8 }}
                        />
                    )}
                    {!loading && query.length > 0 && (
                        <TouchableOpacity
                            onPress={() => { setQuery(''); setPredictions([]); }}
                            style={styles.clearBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={styles.clearText}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {hasError && (
                <Text style={styles.errorText}>Street address is required</Text>
            )}

            {/* Absolutely-positioned dropdown — floats above all other fields */}
            {predictions.length > 0 && (
                <View style={styles.dropdown}>
                    {predictions.map((p, index) => (
                        <TouchableOpacity
                            key={p.place_id}
                            style={[
                                styles.suggestionRow,
                                index < predictions.length - 1 && styles.suggestionBorder,
                            ]}
                            onPress={() => selectPrediction(p)}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.suggestionIcon}>📍</Text>
                            <Text style={styles.suggestionText} numberOfLines={2}>
                                {p.description}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        zIndex: 100,
    },
    inputBox: {
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 8,
    },
    label: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1E293B',
        paddingVertical: 4,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    clearBtn: {
        padding: 4,
    },
    clearText: {
        fontSize: 14,
        color: '#94A3B8',
    },
    errorText: {
        fontSize: 12,
        color: '#B00020',
        marginTop: 4,
        marginLeft: 12,
    },
    dropdown: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 999,
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 10,
    },
    suggestionBorder: {
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    suggestionIcon: {
        fontSize: 14,
    },
    suggestionText: {
        flex: 1,
        fontSize: 14,
        color: '#1E293B',
        lineHeight: 20,
    },
});

export default AddressAutocomplete;
