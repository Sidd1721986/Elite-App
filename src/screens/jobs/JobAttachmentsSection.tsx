import * as React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import FastImage from 'react-native-fast-image';
import { Surface, Text, Button, IconButton, ProgressBar, TextInput, Menu } from 'react-native-paper';

interface JobAttachmentsSectionProps {
    photos?: string[];
    completedPhotos?: string[];
    canAddPhotos: boolean;
    isUploading: boolean;
    uploadProgress: number;
    showAddPhotoMenu: boolean;
    setShowAddPhotoMenu: (show: boolean) => void;
    showPhotoInput: boolean;
    setShowPhotoInput: (show: boolean) => void;
    newPhotoUrl: string;
    setNewPhotoUrl: (url: string) => void;
    isProcessing: boolean;
    isDeletingPhoto: string | null;
    onPhotoUpload: (source: 'camera' | 'library') => void;
    onAddPhotoUrl: () => void;
    onDeletePhoto: (uri: string) => void;
}

export const JobAttachmentsSection: React.FC<JobAttachmentsSectionProps> = React.memo(({
    photos = [],
    completedPhotos = [],
    canAddPhotos,
    isUploading,
    uploadProgress,
    showAddPhotoMenu,
    setShowAddPhotoMenu,
    showPhotoInput,
    setShowPhotoInput,
    newPhotoUrl,
    setNewPhotoUrl,
    isProcessing,
    isDeletingPhoto,
    onPhotoUpload,
    onAddPhotoUrl,
    onDeletePhoto,
}) => {
    return (
        <View style={styles.container}>
            {/* Request Photos Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Request Photos</Text>
                    {canAddPhotos && (
                        <Menu
                            visible={showAddPhotoMenu}
                            onDismiss={() => setShowAddPhotoMenu(false)}
                            anchor={
                                <Button
                                    mode="text"
                                    compact
                                    icon="plus-circle-outline"
                                    onPress={() => setShowAddPhotoMenu(true)}
                                    textColor="#6366F1"
                                    loading={isUploading}
                                >
                                    Add Photo
                                </Button>
                            }
                        >
                            <Menu.Item leadingIcon="camera" onPress={() => onPhotoUpload('camera')} title="Take Photo" />
                            <Menu.Item leadingIcon="image" onPress={() => onPhotoUpload('library')} title="Gallery" />
                            <Menu.Item leadingIcon="link" onPress={() => setShowPhotoInput(true)} title="Paste Link" />
                        </Menu>
                    )}
                </View>

                <Surface style={styles.photosBox} elevation={0}>
                    {isUploading && (
                        <View style={styles.uploadingBox}>
                            <ProgressBar progress={uploadProgress} color="#6366F1" style={styles.progressBar} />
                            <Text variant="labelSmall" style={styles.uploadingText}>Sharing photo...</Text>
                        </View>
                    )}

                    {showPhotoInput && !isUploading && canAddPhotos && (
                        <View style={styles.linkInputBox}>
                            <TextInput
                                placeholder="Paste image URL here..."
                                value={newPhotoUrl}
                                onChangeText={setNewPhotoUrl}
                                mode="outlined"
                                style={styles.linkInput}
                                dense
                                outlineColor="#E2E8F0"
                                activeOutlineColor="#6366F1"
                                right={
                                    <TextInput.Icon
                                        icon="send"
                                        onPress={onAddPhotoUrl}
                                        disabled={!newPhotoUrl.trim() || isProcessing}
                                    />
                                }
                                left={<TextInput.Icon icon="close" onPress={() => setShowPhotoInput(false)} />}
                            />
                        </View>
                    )}

                    {photos.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                            {photos.map(uri => uri ? (
                                <View key={uri} style={styles.photoWrapper}>
                                    <FastImage
                                        source={{ uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
                                        style={styles.photoThumbnail}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                    {canAddPhotos && (
                                        <IconButton
                                            icon="close-circle"
                                            size={20}
                                            iconColor="#EF4444"
                                            style={styles.deletePhotoBtn}
                                            onPress={() => onDeletePhoto(uri)}
                                            loading={isDeletingPhoto === uri}
                                            disabled={!!isDeletingPhoto}
                                        />
                                    )}
                                </View>
                            ) : null)}
                        </ScrollView>
                    ) : (
                        !isUploading && (
                            <View style={styles.emptyPhotoContent}>
                                <IconButton icon="image-off-outline" size={32} iconColor="#CBD5E1" />
                                <Text variant="bodySmall" style={styles.emptyText}>No photos provided for this request.</Text>
                            </View>
                        )
                    )}
                </Surface>
            </View>

            {/* Completed Work Photos */}
            {completedPhotos.length > 0 && (
                <View style={styles.section}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Completed Work Photos</Text>
                    <Surface style={[styles.photosBox, styles.completedPhotosBox]} elevation={0}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoList}>
                            {completedPhotos.map(uri => uri ? (
                                <View key={uri} style={styles.photoWrapper}>
                                    <FastImage
                                        source={{ uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.immutable }}
                                        style={[styles.photoThumbnail, styles.completedThumbnail]}
                                        resizeMode={FastImage.resizeMode.cover}
                                    />
                                </View>
                            ) : null)}
                        </ScrollView>
                    </Surface>
                </View>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        marginBottom: 8,
    },
    section: {
        marginBottom: 24,
        paddingHorizontal: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#1E293B',
    },
    photosBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    completedPhotosBox: {
        borderColor: '#10B98130',
        backgroundColor: '#F0FDF430',
    },
    uploadingBox: {
        padding: 12,
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
    },
    uploadingText: {
        marginTop: 4,
        textAlign: 'center',
        color: '#64748B',
    },
    linkInputBox: {
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginBottom: 8,
    },
    linkInput: {
        backgroundColor: '#FFFFFF',
        fontSize: 13,
    },
    photoList: {
        flexDirection: 'row',
    },
    photoWrapper: {
        position: 'relative',
        marginRight: 10,
    },
    photoThumbnail: {
        width: 100,
        height: 100,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    completedThumbnail: {
        borderColor: '#10B981',
    },
    deletePhotoBtn: {
        position: 'absolute',
        top: -6,
        right: -6,
        margin: 0,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
    },
    emptyPhotoContent: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    emptyText: {
        color: '#94A3B8',
    },
});
