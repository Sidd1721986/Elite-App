/**
 * JobFormModal — extracted from UserDashboard to fix typing lag.
 *
 * WHY THIS FILE EXISTS:
 * When form state (street, city, description, etc.) lived in UserDashboard,
 * every keystroke called setXxx() which re-rendered the ENTIRE screen —
 * FlashList, header, animations, all useMemo checks. Now that form state
 * is isolated here, a keystroke only re-renders this modal. UserDashboard
 * stays completely still while the user types.
 */

import React, { useState, useCallback, useEffect, memo } from 'react';
import {
    View, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {
    Text, Button, Portal, Modal, TextInput,
    Menu, Chip, IconButton, Surface,
} from 'react-native-paper';
import FastImage from 'react-native-fast-image';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { Urgency, Job, User } from '../types/types';
import { AVAILABLE_SERVICES } from '../config/services';
import { formatAddress, parseAddress, US_STATES } from '../utils/addressUtils';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobFormInitialValues {
    street: string;
    city: string;
    zip: string;
    state: string;
    description: string;
    urgency: Urgency;
    otherDetails: string;
    contactPhone: string;
    contactEmail: string;
    photos: string[];
    selectedServices: string[];
}

interface Props {
    visible: boolean;
    editingJobId: string | null;
    initialValues: JobFormInitialValues | null;   // null = new job
    isCustomer: boolean;
    user: User | null;
    onDismiss: () => void;
    onSubmit: (
        data: JobFormInitialValues & {
            address: string;
            services: string[];
            customerId: string;
        },
        editingJobId: string | null,
    ) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaults(user: User | null, initial: JobFormInitialValues | null): JobFormInitialValues {
    if (initial) {return initial;}
    const parts = parseAddress(user?.address);
    return {
        street: parts.street,
        city: parts.city,
        zip: parts.zip,
        state: parts.state,
        description: '',
        urgency: Urgency.NO_RUSH,
        otherDetails: '',
        contactPhone: user?.phone || '',
        contactEmail: user?.email || '',
        photos: [],
        selectedServices: [],
    };
}

// ── Component ─────────────────────────────────────────────────────────────────

const JobFormModal: React.FC<Props> = ({
    visible,
    editingJobId,
    initialValues,
    isCustomer,
    user,
    onDismiss,
    onSubmit,
}) => {
    // ── Form state — isolated here so keystrokes don't touch UserDashboard ──
    const defaults = buildDefaults(user, initialValues);
    const [street, setStreet]               = useState(defaults.street);
    const [city, setCity]                   = useState(defaults.city);
    const [zip, setZip]                     = useState(defaults.zip);
    const [state, setState]                 = useState(defaults.state);
    const [description, setDescription]     = useState(defaults.description);
    const [urgency, setUrgency]             = useState<Urgency>(defaults.urgency);
    const [otherDetails, setOtherDetails]   = useState(defaults.otherDetails);
    const [contactPhone, setContactPhone]   = useState(defaults.contactPhone);
    const [contactEmail, setContactEmail]   = useState(defaults.contactEmail);
    const [photos, setPhotos]               = useState<string[]>(defaults.photos);
    const [selectedServices, setSelectedServices] = useState<string[]>(defaults.selectedServices);

    // Menu visibility
    const [showUrgencyMenu, setShowUrgencyMenu]   = useState(false);
    const [showStateMenu, setShowStateMenu]       = useState(false);
    const [showServicesMenu, setShowServicesMenu] = useState(false);
    const [showPhotoMenu, setShowPhotoMenu]       = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError]           = useState<string | null>(null);

    // Re-seed form when the modal opens with new initialValues
    useEffect(() => {
        if (!visible) {return;}
        const d = buildDefaults(user, initialValues);
        setStreet(d.street);
        setCity(d.city);
        setZip(d.zip);
        setState(d.state);
        setDescription(d.description);
        setUrgency(d.urgency);
        setOtherDetails(d.otherDetails);
        setContactPhone(d.contactPhone);
        setContactEmail(d.contactEmail);
        setPhotos(d.photos);
        setSelectedServices(d.selectedServices);
        setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);   // intentionally only re-seed on open/close, not on every prop change

    // Auto-populate description from selected services (single effect, no chain)
    useEffect(() => {
        setDescription(selectedServices.length > 0 ? selectedServices.join(', ') : '');
    }, [selectedServices]);

    // ── Photo handlers ────────────────────────────────────────────────────────
    const handlePickImage = useCallback(async () => {
        setShowPhotoMenu(false);
        const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 5, includeBase64: false });
        if (result.assets) {
            const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
            setPhotos(prev => [...prev, ...uris]);
        }
    }, []);

    const handleTakePhoto = useCallback(async () => {
        setShowPhotoMenu(false);
        const result = await launchCamera({ mediaType: 'photo', saveToPhotos: true, quality: 0.8, includeBase64: false });
        if (result.assets) {
            const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
            setPhotos(prev => [...prev, ...uris]);
        }
    }, []);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const missingFields: string[] = [];
        if (!street.trim())        {missingFields.push('Address');}
        if (!city.trim())          {missingFields.push('City');}
        if (!zip.trim())           {missingFields.push('Zip');}
        if (!state.trim())         {missingFields.push('State');}
        if (!selectedServices.length) {missingFields.push('Services');}
        if (!description.trim())   {missingFields.push('What needs fixing');}
        if (!contactPhone.trim())  {missingFields.push('Contact Phone');}
        if (!contactEmail.trim())  {missingFields.push('Contact Email');}

        if (missingFields.length > 0) {
            setError(`Missing: ${missingFields.join(', ')}`);
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            setError('Please enter a valid email address');
            return;
        }
        if (!isCustomer) {
            setError('Only User accounts can create service requests.');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            await onSubmit(
                {
                    address: formatAddress({ street, city, zip, state }),
                    street, city, zip, state,
                    description,
                    urgency,
                    otherDetails,
                    contactPhone,
                    contactEmail,
                    photos,
                    selectedServices,
                    services: selectedServices,
                    customerId: user?.id || user?.email || 'anon',
                },
                editingJobId,
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save job request');
        } finally {
            setSubmitting(false);
        }
    }, [
        street, city, zip, state, description, urgency,
        otherDetails, contactPhone, contactEmail, photos,
        selectedServices, isCustomer, editingJobId, onSubmit, user,
    ]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={styles.modalContent}
            >
                <Text variant="headlineSmall" style={styles.modalTitle}>
                    {editingJobId ? 'Edit Service Request' : 'Request Service'}
                </Text>

                {!isCustomer && (
                    <Surface style={styles.adminWarning}>
                        <Text style={styles.adminWarningTitle}>⚠️ Admin/Vendor View</Text>
                        <Text style={styles.adminWarningText}>
                            You are in a read-only preview. Please login as a User to create requests.
                        </Text>
                    </Surface>
                )}

                {error ? (
                    <Surface style={styles.errorBanner}>
                        <Text style={styles.errorText}>{error}</Text>
                    </Surface>
                ) : null}

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Address */}
                    <TextInput
                        label="Service Street Address *"
                        value={street}
                        onChangeText={setStreet}
                        mode="outlined"
                        style={styles.input}
                        left={<TextInput.Icon icon="map-marker-outline" />}
                        testID="job_street_input"
                    />
                    <View style={styles.addressRow}>
                        <TextInput
                            label="City *"
                            value={city}
                            onChangeText={setCity}
                            mode="outlined"
                            style={[styles.input, { flex: 2 }]}
                        />
                        <TextInput
                            label="Zip *"
                            value={zip}
                            onChangeText={setZip}
                            mode="outlined"
                            style={[styles.input, { flex: 1.2 }]}
                            keyboardType="numeric"
                        />
                        <Menu
                            visible={showStateMenu}
                            onDismiss={() => setShowStateMenu(false)}
                            anchor={
                                <TouchableOpacity onPress={() => setShowStateMenu(true)} activeOpacity={1} style={{ flex: 1 }}>
                                    <View pointerEvents="none">
                                        <TextInput
                                            label="State *"
                                            value={state}
                                            mode="outlined"
                                            style={styles.input}
                                            right={<TextInput.Icon icon="chevron-down" />}
                                            editable={false}
                                        />
                                    </View>
                                </TouchableOpacity>
                            }
                        >
                            <ScrollView style={{ maxHeight: 250 }}>
                                {US_STATES.map(s => (
                                    <Menu.Item key={s} onPress={() => { setState(s); setShowStateMenu(false); }} title={s} />
                                ))}
                            </ScrollView>
                        </Menu>
                    </View>

                    {/* Services */}
                    <Text variant="titleSmall" style={styles.sectionLabel}>Select Services Needed *</Text>
                    <Menu
                        visible={showServicesMenu}
                        onDismiss={() => setShowServicesMenu(false)}
                        anchor={
                            <TouchableOpacity onPress={() => setShowServicesMenu(true)} activeOpacity={1}>
                                <View pointerEvents="none">
                                    <TextInput
                                        label="Service Needed *"
                                        value={selectedServices.length > 0 ? `${selectedServices.length} selected` : ''}
                                        mode="outlined"
                                        style={styles.input}
                                        placeholder="Select a service"
                                        editable={false}
                                        right={<TextInput.Icon icon="chevron-down" />}
                                    />
                                </View>
                            </TouchableOpacity>
                        }
                    >
                        <ScrollView style={{ maxHeight: 260 }}>
                            {AVAILABLE_SERVICES.map(service => (
                                <Menu.Item
                                    key={service}
                                    title={service}
                                    leadingIcon={selectedServices.includes(service) ? 'check-circle-outline' : 'plus-circle-outline'}
                                    onPress={() => {
                                        setSelectedServices(prev =>
                                            prev.includes(service) ? prev : [...prev, service],
                                        );
                                        setShowServicesMenu(false);
                                    }}
                                />
                            ))}
                        </ScrollView>
                    </Menu>

                    <View style={styles.chipsRow}>
                        {selectedServices.length === 0 ? (
                            <Text variant="bodySmall" style={styles.chipsHint}>Selected services will appear here.</Text>
                        ) : (
                            selectedServices.map(service => (
                                <Chip
                                    key={service}
                                    mode="outlined"
                                    compact
                                    style={styles.serviceChip}
                                    textStyle={styles.serviceChipText}
                                    onClose={() => setSelectedServices(prev => prev.filter(s => s !== service))}
                                >
                                    {service}
                                </Chip>
                            ))
                        )}
                    </View>

                    {/* Description (auto-populated, read-only) */}
                    <TextInput
                        label="Summary of Services Needed *"
                        value={description}
                        mode="outlined"
                        style={[styles.input, styles.readonlyInput]}
                        multiline
                        numberOfLines={2}
                        editable={false}
                        placeholder="Select services above to populate this summary..."
                    />

                    {/* Contact */}
                    <TextInput
                        label="On-site Contact Phone *"
                        value={contactPhone}
                        onChangeText={setContactPhone}
                        mode="outlined"
                        style={styles.input}
                        keyboardType="phone-pad"
                        testID="job_phone_input"
                    />
                    <TextInput
                        label="On-site Contact Email *"
                        value={contactEmail}
                        onChangeText={setContactEmail}
                        mode="outlined"
                        style={styles.input}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />

                    {/* Urgency */}
                    <View style={styles.urgencyRow}>
                        <Text variant="labelLarge" style={styles.urgencyLabel}>Urgency Level</Text>
                        <Menu
                            visible={showUrgencyMenu}
                            onDismiss={() => setShowUrgencyMenu(false)}
                            anchor={
                                <Button
                                    mode="outlined"
                                    onPress={() => setShowUrgencyMenu(true)}
                                    style={styles.urgencyBtn}
                                    icon="chevron-down"
                                    contentStyle={{ flexDirection: 'row-reverse' }}
                                >
                                    {urgency}
                                </Button>
                            }
                        >
                            {Object.values(Urgency).map(u => (
                                <Menu.Item key={u} onPress={() => { setUrgency(u); setShowUrgencyMenu(false); }} title={u} />
                            ))}
                        </Menu>
                    </View>

                    {/* Additional Notes */}
                    <TextInput
                        label="Additional Notes"
                        value={otherDetails}
                        onChangeText={setOtherDetails}
                        mode="outlined"
                        style={styles.input}
                    />

                    {/* Photos */}
                    <View style={styles.photoSection}>
                        <View style={styles.photoHeader}>
                            <Text variant="labelLarge" style={styles.urgencyLabel}>Work Photos</Text>
                            <Menu
                                visible={showPhotoMenu}
                                onDismiss={() => setShowPhotoMenu(false)}
                                anchor={
                                    <Button mode="text" compact icon="camera-plus" onPress={() => setShowPhotoMenu(true)}>
                                        Add Pictures
                                    </Button>
                                }
                            >
                                <Menu.Item leadingIcon="camera"         onPress={handleTakePhoto}  title="Take Photo" />
                                <Menu.Item leadingIcon="image-multiple" onPress={handlePickImage}  title="Choose from Gallery" />
                            </Menu>
                        </View>
                        {photos.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                {photos.map((uri, index) => (
                                    <View key={index} style={styles.photoWrapper}>
                                        <FastImage source={{ uri }} style={styles.photoThumb} />
                                        <IconButton
                                            icon="close-circle"
                                            size={20}
                                            iconColor="#EF4444"
                                            style={styles.removePhotoBtn}
                                            onPress={() => setPhotos(prev => prev.filter((_, i) => i !== index))}
                                        />
                                    </View>
                                ))}
                            </ScrollView>
                        ) : (
                            <Surface style={styles.emptyPhotoBox} elevation={0}>
                                <IconButton icon="image-plus" size={32} iconColor="#CBD5E1" />
                                <Text variant="bodySmall" style={{ color: '#94A3B8' }}>No photos added yet</Text>
                            </Surface>
                        )}
                    </View>

                    {/* Actions */}
                    <Button
                        mode="contained"
                        onPress={handleSubmit}
                        loading={submitting}
                        disabled={submitting}
                        style={styles.submitBtn}
                        contentStyle={{ height: 50 }}
                        testID="job_submit_btn"
                    >
                        {editingJobId ? 'Save Changes' : 'Submit Request'}
                    </Button>
                    <Button mode="text" onPress={onDismiss} style={{ marginTop: 8 }}>
                        Cancel
                    </Button>
                </ScrollView>
            </Modal>
        </Portal>
    );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    modalContent: {
        backgroundColor: '#FFFFFF',
        padding: 24,
        margin: 20,
        borderRadius: 32,
        maxHeight: '80%',
    },
    modalTitle: {
        fontWeight: '900',
        marginBottom: 20,
        textAlign: 'center',
    },
    adminWarning: {
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        marginBottom: 16,
    },
    adminWarningTitle: { color: '#991B1B', fontWeight: 'bold' },
    adminWarningText: { color: '#991B1B', fontSize: 12 },
    errorBanner: {
        padding: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        marginBottom: 12,
    },
    errorText: { color: '#991B1B', fontSize: 13 },
    input: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
    },
    readonlyInput: {
        backgroundColor: '#F8FAFC',
    },
    addressRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 4,
    },
    sectionLabel: {
        marginTop: 16,
        marginBottom: 8,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
        minHeight: 32,
    },
    chipsHint: { color: '#94A3B8', marginBottom: 8 },
    serviceChip: { backgroundColor: '#EEF2FF', borderColor: '#CBD5FF' },
    serviceChipText: { fontSize: 12, color: '#4338CA' },
    urgencyRow: { marginBottom: 24 },
    urgencyLabel: { marginBottom: 8, color: '#64748B' },
    urgencyBtn: { borderRadius: 12 },
    photoSection: { marginBottom: 24 },
    photoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    photoList: { flexDirection: 'row', marginTop: 8 },
    photoWrapper: { position: 'relative', marginRight: 12 },
    photoThumb: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#F1F5F9' },
    removePhotoBtn: { position: 'absolute', top: -10, right: -10, margin: 0, backgroundColor: '#FFFFFF' },
    emptyPhotoBox: {
        height: 100,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#CBD5E1',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
    },
    submitBtn: { marginTop: 8, borderRadius: 16 },
});

export default memo(JobFormModal);
