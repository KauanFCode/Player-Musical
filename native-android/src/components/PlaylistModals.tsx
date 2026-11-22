import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, ListMusic, Music, Play, Plus, Trash2 } from 'lucide-react-native';
import { usePlayer } from '../context/PlayerContext';
import { COLORS, RADIUS, SPACING } from '../theme/theme';
import { AudioTrack, Playlist } from '../types/music';

interface CreatePlaylistModalProps {
  visible: boolean;
  initialTrack?: AudioTrack | null;
  onClose: () => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  visible,
  initialTrack,
  onClose,
}) => {
  const { createPlaylist } = usePlayer();
  const [name, setName] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Aviso', 'Digite um nome para a playlist.');
      return;
    }
    const pl = createPlaylist(name, initialTrack?.uri);
    setName('');
    onClose();
    Alert.alert('Playlist criada', `"${pl.name}" criada com sucesso!`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Nova Playlist</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome da playlist..."
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate}>
              <Text style={styles.confirmText}>Criar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface AddToPlaylistModalProps {
  visible: boolean;
  track: AudioTrack | null;
  onClose: () => void;
  onCreateNew: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  visible,
  track,
  onClose,
  onCreateNew,
}) => {
  const { userPlaylists, addTrackToPlaylist } = usePlayer();

  if (!track) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.dialogTitle}>Adicionar à Playlist</Text>
            <TouchableOpacity onPress={onClose}>
              <ChevronDown color={COLORS.text} size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.trackSubtitle} numberOfLines={1}>
            {track.name}
          </Text>

          <TouchableOpacity
            style={styles.newPlaylistRow}
            onPress={() => {
              onClose();
              onCreateNew();
            }}
          >
            <Plus color={COLORS.black} size={18} />
            <Text style={styles.newPlaylistText}>Criar Nova Playlist</Text>
          </TouchableOpacity>

          <FlatList
            data={userPlaylists}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 280 }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Nenhuma playlist criada ainda.</Text>
            }
            renderItem={({ item }) => {
              const alreadyAdded = item.trackUris.includes(track.uri);
              return (
                <TouchableOpacity
                  style={styles.playlistOption}
                  onPress={() => {
                    addTrackToPlaylist(item.id, track.uri);
                    onClose();
                    Alert.alert('Adicionada', `Música adicionada em "${item.name}".`);
                  }}
                >
                  <ListMusic color={COLORS.primary} size={20} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.playlistOptionTitle}>{item.name}</Text>
                    <Text style={styles.playlistOptionSub}>
                      {item.trackUris.length} músicas {alreadyAdded ? '• Já adicionada' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

interface PlaylistDetailModalProps {
  playlist: Playlist | null;
  onClose: () => void;
}

export const PlaylistDetailModal: React.FC<PlaylistDetailModalProps> = ({
  playlist,
  onClose,
}) => {
  const {
    libraryTracks,
    userPlaylists,
    getTrackArtwork,
    playQueue,
    removeTrackFromPlaylist,
    setPlayerModalVisible,
  } = usePlayer();

  if (!playlist) return null;

  const currentPl = userPlaylists.find((p) => p.id === playlist.id) || playlist;
  const tracks = libraryTracks.filter((t) => currentPl.trackUris.includes(t.uri));

  const handlePlayAll = async () => {
    if (tracks.length === 0) {
      Alert.alert('Playlist Vazia', 'Adicione músicas à playlist primeiro.');
      return;
    }
    await playQueue(tracks, 0);
    onClose();
    setPlayerModalVisible(true);
  };

  return (
    <Modal visible={!!playlist} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.fullContainer} edges={['top', 'bottom']}>
        <View style={styles.fullHeader}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <ChevronDown color={COLORS.text} size={28} />
          </TouchableOpacity>
          <Text style={styles.fullHeaderTitle} numberOfLines={1}>
            {currentPl.name}
          </Text>
          <TouchableOpacity onPress={handlePlayAll} style={styles.playAllBtn}>
            <Play color={COLORS.black} size={16} fill={COLORS.black} />
            <Text style={styles.playAllText}>Tocar</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={tracks}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <ListMusic color={COLORS.textMuted} size={40} />
              <Text style={styles.emptyText}>Esta playlist está vazia.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const art = getTrackArtwork(item);
            return (
              <TouchableOpacity
                style={styles.trackRow}
                onPress={async () => {
                  await playQueue(tracks, index);
                  onClose();
                  setPlayerModalVisible(true);
                }}
              >
                {art ? (
                  <Image source={{ uri: art }} style={styles.trackArt} />
                ) : (
                  <View style={styles.trackArtPlaceholder}>
                    <Music color={COLORS.textMuted} size={18} />
                  </View>
                )}
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.trackName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => removeTrackFromPlaylist(currentPl.id, item.uri)}
                >
                  <Trash2 color={COLORS.danger} size={18} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  dialog: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dialogTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: 12,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.sm,
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: RADIUS.sm,
  },
  confirmText: {
    color: COLORS.black,
    fontWeight: '700',
  },
  sheet: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 14,
  },
  newPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: RADIUS.md,
    marginBottom: 12,
  },
  newPlaylistText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 14,
  },
  playlistOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  playlistOptionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  playlistOptionSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
  },
  fullContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullHeaderTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  playAllText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackArt: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    marginRight: 12,
  },
  trackArtPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  trackArtist: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
