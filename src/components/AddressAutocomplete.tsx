/**
 * AddressAutocomplete — Google Places-powered address search field.
 *
 * Replaces the manual Street / City / Zip / State fields with a single
 * smart input that auto-suggests and auto-fills all address parts.
 *
 * Usage:
 *   <AddressAutocomplete
 *     label="Service Address"
 *     hasError={submitted && !street}
 *     onAddressSelect={({ street, city, zip, state }) => {
 *       setStreet(street); setCity(city); setZip(zip); setState(state);
 *     }}
 *     initialValue={formatAddress({ street, city, zip, state })}
 *   />
 */

import React, { useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../config/env';

export interface AddressParts {
    street: string;
    city: string;
    zip: string;
    state: string;
}

interface Props {
    label?: string;
    hasError?: boolean;
    initialValue?: string;
    onAddressSelect: (parts: AddressParts) => void;
    onClear?: () => void;
}

/** Parse Google Places address_components into our AddressParts shape. */
function parseGoogleComponents(components: any[]): AddressParts {
    const get = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.short_name ?? '';
    const getLong = (type: string) =>
        components.find((c: any) => c.types.includes(type))?.long_name ?? '';

    const streetNumber = get('street_number');
    const route = getLong('route');
    const street = [streetNumber, route].filter(Boolean).join(' ');
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
    label = 'Address',
    hasError = false,
    initialValue = '',
    onAddressSelect,
    onClear,
}) => {
    const ref = useRef<any>(null);
    const [selected, setSelected] = useState(false);

    const borderColor = hasError ? '#B00020' : selected ? '#6366F1' : '#E2E8F0';
    const labelColor  = hasError ? '#B00020' : '#6366F1';

    return (
        <View style={[styles.wrapper, { borderColor, borderWidth: selected || hasError ? 2 : 1 }]}>
            {/* Floating label */}
            <Text style={[styles.floatingLabel, { color: labelColor }]}>{label}</Text>

            <GooglePlacesAutocomplete
                ref={ref}
                placeholder="Search address…"
                fetchDetails
                enablePoweredByContainer={false}
                query={{
                    key: GOOGLE_PLACES_API_KEY,
                    language: 'en',
                    components: 'country:us',
                    types: 'address',
                }}
                textInputProps={{
                    defaultValue: initialValue,
                    placeholderTextColor: '#94A3B8',
                    style: styles.textInput,
                    clearButtonMode: 'while-editing',
                    onFocus: () => setSelected(true),
                    onBlur: () => setSelected(false),
                }}
                styles={{
                    container: { flex: 0 },
                    textInput: styles.textInput,
                    listView: styles.listView,
                    row: styles.row,
                    description: styles.description,
                    separator: styles.separator,
                    poweredContainer: { display: 'none' },
                }}
                onPress={(data, details) => {
                    if (!details?.address_components) {return;}
                    const parts = parseGoogleComponents(details.address_components);
                    onAddressSelect(parts);
                    setSelected(false);
                }}
                onFail={(err) => console.warn('[AddressAutocomplete] error:', err)}
            />

            {hasError && (
                <Text style={styles.errorText}>Address is required</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
        paddingTop: 8,
        paddingHorizontal: 12,
        paddingBottom: 4,
        position: 'relative',
    },
    floatingLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 2,
        letterSpacing: 0.2,
    },
    textInput: {
        fontSize: 16,
        color: '#1E293B',
        paddingVertical: Platform.OS === 'ios' ? 4 : 2,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
        borderWidth: 0,
        height: 40,
    },
    listView: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
        zIndex: 999,
    },
    row: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
    },
    description: {
        fontSize: 14,
        color: '#1E293B',
    },
    separator: {
        height: 1,
        backgroundColor: '#F1F5F9',
    },
    errorText: {
        fontSize: 12,
        color: '#B00020',
        marginTop: 2,
        marginBottom: 4,
    },
});

export default AddressAutocomplete;
