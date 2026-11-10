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
    View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform,
} from 'react-native';
import {
    Text, Button, Portal, Modal, TextInput,
    Menu, Chip, IconButton, Surface, SegmentedButtons,
} from 'react-native-paper';
import FastImage from 'react-native-fast-image';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { Urgency, Job, User } from '../types/types';
import { jobService } from '../services/jobService';
import { AVAILABLE_SERVICES } from '../config/services';
import { formatAddress, parseAddress } from '../utils/addressUtils';
import { parseDimensionString, formatDimensionString } from '../utils/dimensionUtils';
import AddressAutocomplete from '../components/AddressAutocomplete';

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
    dimensions?: string;
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
            dimensions?: string;
        },
        editingJobId: string | null,
    ) => Promise<void>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDefaults(user: User | null, initial: JobFormInitialValues | null): JobFormInitialValues {
    if (initial) {
        return {
            ...initial,
            dimensions: initial.dimensions || '',
        };
    }
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
        dimensions: '',
    };
}

// ── Measured items (windows / doors / roof sections) ─────────────────────────

interface DimItem {
    id: string;
    width: string;
    height: string;
    unit: 'in' | 'ft';
    description: string;
    photos: string[];
}

const BLUE = '#2563EB';

function newDimItem(): DimItem {
    return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, width: '', height: '', unit: 'in', description: '', photos: [] };
}

/** Parses the stored dimensions string (one item per line, optionally prefixed "Item N:"). */
function parseDimItems(raw?: string): DimItem[] {
    const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { return [newDimItem()]; }
    return lines.map(line => {
        const p = parseDimensionString(line.replace(/^Item\s*\d+:\s*/i, ''));
        return { ...newDimItem(), width: p.width, height: p.height, unit: p.unit, description: p.notes };
    });
}

function formatDimItems(items: DimItem[]): string {
    const parts = items
        .map(it => formatDimensionString(it.width, it.height, it.unit, it.description))
        .map((s, i) => (s ? (items.length > 1 ? `Item ${i + 1}: ${s}` : s) : ''))
        .filter(Boolean);
    return parts.join('\n');
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
    // Single source of truth for the address. It holds whatever is visible in the field —
    // whether it came from a Google suggestion or was typed by hand — so a manually typed
    // address can never be silently dropped at submit time.
    const [addressText, setAddressText]     = useState(() => formatAddress(defaults));
    const [description, setDescription]     = useState(defaults.description);
    const [urgency, setUrgency]             = useState<Urgency>(defaults.urgency);
    const [otherDetails, setOtherDetails]   = useState(defaults.otherDetails);
    const [contactPhone, setContactPhone]   = useState(defaults.contactPhone);
    const [contactEmail, setContactEmail]   = useState(defaults.contactEmail);
    const [photos, setPhotos]               = useState<string[]>(defaults.photos);
    const [selectedServices, setSelectedServices] = useState<string[]>(defaults.selectedServices);

    // Measured items: each window/door has its own size, description and photos
    const [dimItems, setDimItems] = useState<DimItem[]>(() => parseDimItems(defaults.dimensions));

    const updateDimItem = useCallback((id: string, patch: Partial<DimItem>) => {
        setDimItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
    }, []);
    const addDimItem = useCallback(() => setDimItems(prev => [...prev, newDimItem()]), []);
    const removeDimItem = useCallback((id: string) => {
        setDimItems(prev => (prev.length > 1 ? prev.filter(it => it.id !== id) : [newDimItem()]));
    }, []);

    const addItemPhotos = useCallback((id: string) => {
        const append = (uris: string[]) =>
            setDimItems(prev => prev.map(it => (it.id === id ? { ...it, photos: [...it.photos, ...uris] } : it)));
        const handle = (result: any) => {
            if (result?.didCancel) { return; }
            if (result?.errorCode) {
                Alert.alert('Photo Error', result.errorMessage || 'Could not get photo. Check permissions in Settings.');
                return;
            }
            append((result?.assets || []).map((a: any) => a.uri).filter(Boolean));
        };
        Alert.alert('Add Photo', 'Choose a source', [
            { text: 'Take Photo', onPress: () => launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: true }).then(handle).catch(() => {}) },
            { text: 'Gallery', onPress: () => launchImageLibrary({ mediaType: 'photo', selectionLimit: 5, quality: 0.8 }).then(handle).catch(() => {}) },
            { text: 'Cancel', style: 'cancel' },
        ]);
    }, []);

    // Menu visibility
    const [showUrgencyMenu, setShowUrgencyMenu]   = useState(false);
    const [showServicesMenu, setShowServicesMenu] = useState(false);
    const [showPhotoMenu, setShowPhotoMenu]       = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError]           = useState<string | null>(null);

    // Re-seed form when the modal opens with new initialValues
    useEffect(() => {
        if (!visible) {return;}
        const d = buildDefaults(user, initialValues);
        setAddressText(formatAddress(d));
        setDescription(d.description);
        setUrgency(d.urgency);
        setOtherDetails(d.otherDetails);
        setContactPhone(d.contactPhone);
        setContactEmail(d.contactEmail);
        setPhotos(d.photos);
        setSelectedServices(d.selectedServices);
        setDimItems(parseDimItems(d.dimensions));
        setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);   // intentionally only re-seed on open/close, not on every prop change

    // Check if any selected service is for roof, windows, or doors
    const hasRoofWindowDoorSelected = selectedServices.some(service => {
        const s = service.toLowerCase();
        return s.includes('roof') || s.includes('window') || s.includes('door');
    });

    // Auto-populate description from selected services (single effect, no chain)
    useEffect(() => {
        setDescription(selectedServices.length > 0 ? selectedServices.join(', ') : '');
    }, [selectedServices]);

    // ── Photo handlers ────────────────────────────────────────────────────────
    const handlePickImage = useCallback(async () => {
        setShowPhotoMenu(false);
        // Give the modal time to dismiss before opening the native picker
        await new Promise(resolve => setTimeout(resolve, Platform.OS === 'ios' ? 400 : 200));
        try {
            const result = await launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 5,
                includeBase64: false,
                quality: 0.8,
            });
            if (result.didCancel) { return; }
            if (result.errorCode) {
                Alert.alert('Gallery Error', result.errorMessage || 'Could not open gallery. Please check permissions in Settings.');
                return;
            }
            if (result.assets) {
                const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
                setPhotos(prev => [...prev, ...uris]);
            }
        } catch (err) {
            Alert.alert('Error', 'Could not open photo gallery.');
        }
    }, []);

    const handleTakePhoto = useCallback(async () => {
        setShowPhotoMenu(false);
        // Give the modal time to dismiss before opening the native camera
        await new Promise(resolve => setTimeout(resolve, Platform.OS === 'ios' ? 400 : 200));
        try {
            const result = await launchCamera({
                mediaType: 'photo',
                saveToPhotos: true,
                quality: 0.8,
                includeBase64: false,
                cameraType: 'back',
            });
            if (result.didCancel) { return; }
            if (result.errorCode === 'camera_unavailable') {
                Alert.alert('Camera Unavailable', 'No camera found on this device.');
                return;
            }
            if (result.errorCode === 'permission') {
                Alert.alert(
                    'Camera Permission Required',
                    'Please allow camera access in Settings → Privacy → Camera → Elite Home Services.',
                    [{ text: 'OK' }]
                );
                return;
            }
            if (result.errorCode) {
                Alert.alert('Camera Error', result.errorMessage || 'Could not open camera.');
                return;
            }
            if (result.assets) {
                const uris = result.assets.map(a => a.uri).filter(Boolean) as string[];
                setPhotos(prev => [...prev, ...uris]);
            }
        } catch (err) {
            Alert.alert('Error', 'Could not open camera.');
        }
    }, []);

    // Local picker/camera URIs (file://…) only exist on this device — they must be uploaded
    // and swapped for server URLs before submit, or admin/vendor devices render blank images.
    const uploadLocalPhotos = useCallback(async (uris: string[]): Promise<string[]> => {
        const out: string[] = [];
        for (const uri of uris) {
            if (/^https?:\/\//i.test(uri)) { out.push(uri); continue; }
            const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
            const type =
                ext === 'png' ? 'image/png' :
                ext === 'webp' ? 'image/webp' :
                ext === 'heic' || ext === 'heif' ? `image/${ext}` :
                'image/jpeg';
            const { url } = await jobService.uploadFile({ uri, type, name: `photo.${ext}` });
            out.push(url);
        }
        return out;
    }, []);

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        const address = addressText.trim();
        const missingFields: string[] = [];
        if (!address)              {missingFields.push('Address');}
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
            let uploadedPhotos: string[];
            try {
                uploadedPhotos = await uploadLocalPhotos(photos);
                if (hasRoofWindowDoorSelected) {
                    for (const it of dimItems) {
                        if (it.photos.length) {
                            uploadedPhotos.push(...(await uploadLocalPhotos(it.photos)));
                        }
                    }
                }
            } catch {
                setError('Photo upload failed. Check your connection and try again.');
                return;
            }
            const formattedDimensions = hasRoofWindowDoorSelected ? formatDimItems(dimItems) : '';
            await onSubmit(
                {
                    address,
                    ...parseAddress(address),
                    description,
                    urgency,
                    otherDetails,
                    contactPhone,
                    contactEmail,
                    photos: uploadedPhotos,
                    selectedServices,
                    services: selectedServices,
                    dimensions: formattedDimensions || undefined,
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
        addressText, description, urgency,
        otherDetails, contactPhone, contactEmail, photos,
        selectedServices, dimItems, hasRoofWindowDoorSelected, isCustomer, editingJobId, onSubmit, user,
        uploadLocalPhotos,
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
                    <AddressAutocomplete
                        label="Service Address *"
                        hasError={false}
                        initialValue={addressText}
                        onChangeText={setAddressText}
                        onAddressSelect={(parts) => setAddressText(formatAddress(parts))}
                    />

                    {/* Services Dropdown */}
                    <View style={styles.dropdownContainer}>
                        <TouchableOpacity
                            onPress={() => {
                                setShowServicesMenu(prev => !prev);
                                setShowUrgencyMenu(false);
                            }}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Select Services Needed"
                        >
                            <View pointerEvents="none">
                                <TextInput
                                    label="Services Needed *"
                                    value={selectedServices.length > 0 ? `${selectedServices.length} service${selectedServices.length > 1 ? 's' : ''} selected` : ''}
                                    mode="outlined"
                                    style={styles.input}
                                    placeholder="Select services"
                                    editable={false}
                                    right={<TextInput.Icon icon={showServicesMenu ? "chevron-up" : "chevron-down"} />}
                                    outlineColor="#93C5FD"
                                    activeOutlineColor={BLUE}
                                    textColor="#1E3A8A"
                                />
                            </View>
                        </TouchableOpacity>

                        {showServicesMenu && (
                            <Surface style={styles.dropdownMenu} elevation={2}>
                                <ScrollView
                                    style={{ maxHeight: 240 }}
                                    nestedScrollEnabled={true}
                                    showsVerticalScrollIndicator={true}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {AVAILABLE_SERVICES.map(service => {
                                        const isSelected = selectedServices.includes(service);
                                        return (
                                            <TouchableOpacity
                                                key={service}
                                                style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                                                onPress={() => {
                                                    setSelectedServices(prev =>
                                                        prev.includes(service)
                                                            ? prev.filter(s => s !== service)
                                                            : [...prev, service]
                                                    );
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <IconButton
                                                    icon={isSelected ? 'check-circle' : 'plus-circle-outline'}
                                                    iconColor={isSelected ? BLUE : '#64748B'}
                                                    size={22}
                                                    style={{ margin: 0, marginRight: 12 }}
                                                />
                                                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                                                    {service}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                                <TouchableOpacity
                                    style={styles.dropdownDoneBtn}
                                    onPress={() => setShowServicesMenu(false)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.dropdownDoneText}>Done ({selectedServices.length} selected)</Text>
                                </TouchableOpacity>
                            </Surface>
                        )}
                    </View>

                    {selectedServices.length > 0 && (
                        <View style={styles.chipsRow}>
                            {selectedServices.map(service => (
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
                            ))}
                        </View>
                    )}

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

                    {/* Urgency Dropdown */}
                    <View style={styles.dropdownContainer}>
                        <TouchableOpacity
                            onPress={() => {
                                setShowUrgencyMenu(prev => !prev);
                                setShowServicesMenu(false);
                            }}
                            activeOpacity={0.8}
                            accessibilityRole="button"
                            accessibilityLabel="Select Urgency Level"
                        >
                            <View pointerEvents="none">
                                <TextInput
                                    label="Urgency Level *"
                                    value={urgency}
                                    mode="outlined"
                                    style={styles.input}
                                    editable={false}
                                    right={<TextInput.Icon icon={showUrgencyMenu ? "chevron-up" : "chevron-down"} />}
                                    outlineColor="#93C5FD"
                                    activeOutlineColor={BLUE}
                                    textColor="#1E3A8A"
                                />
                            </View>
                        </TouchableOpacity>

                        {showUrgencyMenu && (
                            <Surface style={styles.dropdownMenu} elevation={2}>
                                <ScrollView
                                    style={{ maxHeight: 200 }}
                                    nestedScrollEnabled={true}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {Object.values(Urgency).map(u => {
                                        const isSelected = urgency === u;
                                        return (
                                            <TouchableOpacity
                                                key={u}
                                                style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                                                onPress={() => {
                                                    setUrgency(u);
                                                    setShowUrgencyMenu(false);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <IconButton
                                                    icon={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                                                    iconColor={isSelected ? BLUE : '#64748B'}
                                                    size={22}
                                                    style={{ margin: 0, marginRight: 12 }}
                                                />
                                                <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                                                    {u}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </Surface>
                        )}
                    </View>

                    {/* Additional Notes */}
                    <TextInput
                        label="Additional Notes"
                        value={otherDetails}
                        onChangeText={setOtherDetails}
                        mode="outlined"
                        style={styles.input}
                    />

                    {/* Measured items: ONLY displayed when roof, windows, or doors is selected */}
                    {hasRoofWindowDoorSelected && (
                        <Surface style={styles.dimensionsSection} elevation={0}>
                            <View style={styles.dimensionsHeader}>
                                <View style={styles.dimensionsIconBadge}>
                                    <IconButton icon="ruler-square" size={20} iconColor={BLUE} style={{ margin: 0 }} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleSmall" style={styles.dimensionsTitle}>
                                        Windows, Doors & Measurements
                                    </Text>
                                    <Text variant="bodySmall" style={styles.dimensionsSubtitle}>
                                        Add each window or door with its size, a description and photos
                                    </Text>
                                </View>
                            </View>

                            {dimItems.map((item, index) => (
                                <View key={item.id} style={styles.itemCard}>
                                    <View style={styles.itemCardHeader}>
                                        <Text style={styles.itemCardTitle}>Item {index + 1}</Text>
                                        {dimItems.length > 1 && (
                                            <IconButton
                                                icon="trash-can-outline"
                                                size={18}
                                                iconColor="#EF4444"
                                                style={{ margin: 0 }}
                                                onPress={() => removeDimItem(item.id)}
                                                accessibilityLabel={`Remove item ${index + 1}`}
                                            />
                                        )}
                                    </View>

                                    <SegmentedButtons
                                        value={item.unit}
                                        onValueChange={v => updateDimItem(item.id, { unit: v as 'in' | 'ft' })}
                                        buttons={[
                                            { value: 'in', label: 'Inches (in)' },
                                            { value: 'ft', label: 'Feet (ft)' },
                                        ]}
                                        style={styles.segmentedUnitButtons}
                                        density="small"
                                        theme={{ colors: { secondaryContainer: '#DBEAFE', onSecondaryContainer: '#1E40AF', outline: '#93C5FD' } }}
                                    />

                                    <View style={styles.dimensionInputsRow}>
                                        <View style={styles.dimensionInputCol}>
                                            <TextInput
                                                label={`Width (${item.unit})`}
                                                placeholder={item.unit === 'in' ? 'e.g. 36' : 'e.g. 3'}
                                                value={item.width}
                                                onChangeText={t => updateDimItem(item.id, { width: t })}
                                                mode="outlined"
                                                keyboardType="decimal-pad"
                                                style={styles.dimensionInput}
                                                outlineColor="#BFDBFE"
                                                activeOutlineColor={BLUE}
                                                testID={`job_dimension_width_${index}`}
                                            />
                                        </View>
                                        <View style={styles.dimensionTimesCol}>
                                            <Text style={styles.dimensionTimesText}>×</Text>
                                        </View>
                                        <View style={styles.dimensionInputCol}>
                                            <TextInput
                                                label={`Height (${item.unit})`}
                                                placeholder={item.unit === 'in' ? 'e.g. 80' : 'e.g. 6.5'}
                                                value={item.height}
                                                onChangeText={t => updateDimItem(item.id, { height: t })}
                                                mode="outlined"
                                                keyboardType="decimal-pad"
                                                style={styles.dimensionInput}
                                                outlineColor="#BFDBFE"
                                                activeOutlineColor={BLUE}
                                                testID={`job_dimension_height_${index}`}
                                            />
                                        </View>
                                    </View>

                                    <TextInput
                                        label="Description"
                                        placeholder="e.g. Front door, double-hung vinyl window, impact glass needed"
                                        value={item.description}
                                        onChangeText={t => updateDimItem(item.id, { description: t })}
                                        mode="outlined"
                                        multiline
                                        numberOfLines={3}
                                        style={styles.dimensionNotesInput}
                                        outlineColor="#BFDBFE"
                                        activeOutlineColor={BLUE}
                                        testID={`job_dimension_notes_${index}`}
                                    />

                                    <View style={styles.itemPhotoRow}>
                                        {item.photos.map((uri, pIdx) => (
                                            <View key={`${uri}-${pIdx}`} style={styles.photoWrapper}>
                                                <FastImage source={{ uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }} style={styles.photoThumb} />
                                                <IconButton
                                                    icon="close-circle"
                                                    size={20}
                                                    iconColor="#EF4444"
                                                    style={styles.removePhotoBtn}
                                                    onPress={() => updateDimItem(item.id, { photos: item.photos.filter((_, i) => i !== pIdx) })}
                                                />
                                            </View>
                                        ))}
                                        <TouchableOpacity style={styles.itemAddPhotoBtn} onPress={() => addItemPhotos(item.id)} activeOpacity={0.8}>
                                            <IconButton icon="camera-plus-outline" size={22} iconColor={BLUE} style={{ margin: 0 }} />
                                            <Text style={styles.itemAddPhotoText}>Photo</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            <Button
                                mode="contained"
                                icon="plus"
                                onPress={addDimItem}
                                buttonColor={BLUE}
                                style={styles.addItemBtn}
                                testID="job_add_dimension_item"
                            >
                                Add Another Window / Door
                            </Button>
                        </Surface>
                    )}

                    {/* Photos */}
                    <View style={styles.photoSection}>
                        <View style={styles.photoHeader}>
                            <Text variant="labelLarge" style={styles.urgencyLabel}>Work Photos</Text>
                            <Button mode="text" compact icon="camera-plus" onPress={() => setShowPhotoMenu(true)}>
                                Add Pictures
                            </Button>
                        </View>

                        {/* Photo picker bottom sheet */}
                        <Portal>
                            <Modal
                                visible={showPhotoMenu}
                                onDismiss={() => setShowPhotoMenu(false)}
                                contentContainerStyle={styles.photoPickerSheet}
                            >
                                <Text variant="titleMedium" style={styles.photoPickerTitle}>Add Photo</Text>
                                <View style={styles.photoPickerRow}>
                                    <TouchableOpacity style={styles.photoPickerOption} onPress={handleTakePhoto}>
                                        <View style={styles.photoPickerIcon}>
                                            <IconButton icon="camera" size={32} iconColor="#6366F1" />
                                        </View>
                                        <Text variant="labelMedium" style={styles.photoPickerLabel}>Camera</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.photoPickerOption} onPress={handlePickImage}>
                                        <View style={styles.photoPickerIcon}>
                                            <IconButton icon="image-multiple" size={32} iconColor="#6366F1" />
                                        </View>
                                        <Text variant="labelMedium" style={styles.photoPickerLabel}>Gallery</Text>
                                    </TouchableOpacity>
                                </View>
                                <Button mode="text" onPress={() => setShowPhotoMenu(false)} style={{ marginTop: 4 }}>
                                    Cancel
                                </Button>
                            </Modal>
                        </Portal>
                        {photos.length > 0 ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                                {photos.map((uri, index) => (
                                    <View key={index} style={styles.photoWrapper}>
                                        <FastImage source={{ uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }} style={styles.photoThumb} />
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
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
        minHeight: 24,
    },
    serviceChip: { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' },
    serviceChipText: { fontSize: 12, color: '#1E40AF' },
    urgencyLabel: { marginBottom: 8, color: '#64748B' },
    dropdownContainer: {
        marginBottom: 12,
    },
    dropdownMenu: {
        backgroundColor: '#EFF6FF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        marginTop: 4,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#DBEAFE',
    },
    dropdownItemSelected: {
        backgroundColor: '#DBEAFE',
    },
    dropdownItemText: {
        fontSize: 15,
        color: '#1E3A8A',
        flex: 1,
        fontWeight: '500',
    },
    dropdownItemTextSelected: {
        fontWeight: '700',
        color: BLUE,
    },
    dropdownDoneBtn: {
        backgroundColor: BLUE,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    dropdownDoneText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    dimensionsSection: {
        backgroundColor: '#F8FBFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    dimensionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 10,
    },
    dimensionsIconBadge: {
        backgroundColor: '#DBEAFE',
        borderRadius: 10,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dimensionsTitle: {
        fontWeight: '700',
        color: '#1E293B',
    },
    dimensionsSubtitle: {
        color: '#64748B',
        fontSize: 12,
        marginTop: 2,
    },
    unitSelectorWrap: {
        marginBottom: 12,
    },
    unitSelectorLabel: {
        color: '#64748B',
        fontWeight: 'bold',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    segmentedUnitButtons: {
        backgroundColor: '#FFFFFF',
        marginBottom: 10,
    },
    dimensionInputsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    dimensionInputCol: {
        flex: 1,
    },
    dimensionTimesCol: {
        width: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dimensionTimesText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#64748B',
    },
    dimensionInput: {
        backgroundColor: '#FFFFFF',
    },
    dimensionNotesInput: {
        backgroundColor: '#FFFFFF',
        marginBottom: 8,
    },
    dimensionHintText: {
        color: '#6366F1',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    itemCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        padding: 12,
        marginBottom: 12,
    },
    itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 28 },
    itemCardTitle: { fontWeight: '700', color: '#1E40AF', fontSize: 14 },
    itemPhotoRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    itemAddPhotoBtn: {
        width: 70,
        height: 70,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#93C5FD',
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemAddPhotoText: { fontSize: 11, color: BLUE, fontWeight: '600', marginTop: -4 },
    addItemBtn: { borderRadius: 12, marginTop: 4 },
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
    photoPickerSheet: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 24,
        marginBottom: 40,
        borderRadius: 20,
        padding: 24,
        alignSelf: 'flex-end',
        width: '88%',
    },
    photoPickerTitle: {
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: '600',
        color: '#1E293B',
    },
    photoPickerRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 8,
    },
    photoPickerOption: {
        alignItems: 'center',
        flex: 1,
    },
    photoPickerIcon: {
        width: 72,
        height: 72,
        borderRadius: 16,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    photoPickerLabel: {
        color: '#1E293B',
        fontWeight: '500',
    },
});

export default memo(JobFormModal);
