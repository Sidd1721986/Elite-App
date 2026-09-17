import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, Avatar, TextInput } from 'react-native-paper';

interface NoteItem {
    id: string;
    authorId?: string;
    content: string;
    createdAt: string;
}

interface JobNotesSectionProps {
    notes: NoteItem[];
    noteContent: string;
    onChangeNoteContent: (text: string) => void;
    onAddNote: () => void;
    isSubmitting?: boolean;
}

export const JobNotesSection: React.FC<JobNotesSectionProps> = React.memo(({
    notes,
    noteContent,
    onChangeNoteContent,
    onAddNote,
    isSubmitting,
}) => {
    return (
        <View style={styles.section}>
            <Text variant="titleMedium" style={styles.sectionTitle}>Portal Notes</Text>
            <Surface style={styles.notesBox} elevation={0}>
                <View style={styles.notesList}>
                    {Array.isArray(notes) && notes.length > 0 ? (
                        notes.map(note => {
                            const date = new Date(note.createdAt);
                            const dateString = isNaN(date.getTime()) ? 'Recent' : date.toLocaleDateString();

                            return (
                                <View key={note.id} style={styles.noteItem}>
                                    <View style={styles.noteHeader}>
                                        <Avatar.Text
                                            size={20}
                                            label={String(note.authorId || 'S').substring(0, 2).toUpperCase()}
                                            style={styles.authorAvatar}
                                            labelStyle={styles.authorAvatarLabel}
                                        />
                                        <Text variant="labelSmall" style={styles.noteDate}>
                                            {dateString}
                                        </Text>
                                    </View>
                                    <Text variant="bodyMedium" style={styles.noteContentText}>
                                        {note.content || ''}
                                    </Text>
                                </View>
                            );
                        })
                    ) : (
                        <View style={styles.emptyNotes}>
                            <Text variant="bodySmall" style={styles.emptyText}>
                                No notes in this portal yet.
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.addNoteContainer}>
                    <TextInput
                        placeholder="Add a progress update..."
                        value={noteContent}
                        onChangeText={onChangeNoteContent}
                        mode="outlined"
                        style={styles.noteInput}
                        multiline
                        dense
                        outlineColor="#E2E8F0"
                        activeOutlineColor="#6366F1"
                        right={
                            <TextInput.Icon
                                icon="send"
                                disabled={!noteContent.trim() || isSubmitting}
                                onPress={onAddNote}
                                color={noteContent.trim() ? '#6366F1' : '#CBD5E1'}
                            />
                        }
                    />
                </View>
            </Surface>
        </View>
    );
});

const styles = StyleSheet.create({
    section: {
        marginBottom: 24,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 12,
    },
    notesBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    notesList: {
        marginBottom: 12,
    },
    noteItem: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    authorAvatar: {
        backgroundColor: '#E2E8F0',
    },
    authorAvatarLabel: {
        fontSize: 10,
        color: '#475569',
    },
    noteDate: {
        color: '#94A3B8',
    },
    noteContentText: {
        color: '#334155',
        lineHeight: 18,
    },
    emptyNotes: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94A3B8',
    },
    addNoteContainer: {
        marginTop: 4,
    },
    noteInput: {
        backgroundColor: '#FFFFFF',
        fontSize: 13,
    },
});
