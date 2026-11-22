import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowUpDown,
  Heart,
  ListMusic,
  Play,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { usePlayer } from '../context/PlayerContext';
import {
  CreatePlaylistModal,
  PlaylistDetailModal,
} from '../components/PlaylistModals';
import { COLORS, RADIUS, SPACING } from '../theme/theme';
import { Playlist } from '../types/music';

export default function PlaylistsScreen() {
  const {
    libraryTracks,
    userPlaylists,
    favoriteUris,
    currentTrack,
    getTrackArtwork,
    playQueue,
    deletePlaylist,
    setPlayerModalVisible,
  } = usePlayer();

  const [sortAlpha, setSortAlpha] = useState(false);
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const favoriteTracks = useMemo(
    () => libraryTracks.filter((t) => favoriteUris.includes(t.uri)),
    [favoriteUris, libraryTracks]
  );

  const sortedPlaylists = useMemo(() => {
    const arr = [...userPlaylists];
    if (sortAlpha) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      arr.sort((a, b) => b.createdAt - a.createdAt);
    }
    return arr;
  }, [sortAlpha, userPlaylists]);

  const handlePlayFavorites = async () => {
    if (favoriteTracks.length === 0) {
      Alert.alert(
        'Sem Favoritas',
        'Toque no coração em qualquer música para montar sua lista de favoritas automaticamente.'
      );
      return;
    }
    await playQueue(favoriteTracks, 0);
    setPlayerModalVisible(true);
  };

  const handlePlayPlaylist = async (pl: Playlist) => {
    const tracks = libraryTracks.filter((t) => pl.trackUris.includes(t.uri));
    if (tracks.length === 0) {
      Alert.alert('Playlist Vazia', 'Adicione músicas a esta playlist primeiro.');
      return;
    }
    await playQueue(tracks, 0);
    setPlayerModalVisible(true);
  };

  const confirmDeletePlaylist = (pl: Playlist) => {
    Alert.alert('Excluir Playlist', `Deseja excluir "${pl.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deletePlaylist(pl.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Playlists</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{userPlaylists.length}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => setIsCreateVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Criar nova playlist"
        >
          <Plus color={COLORS.black} size={16} />
          <Text style={styles.newBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedPlaylists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: currentTrack ? 110 : 24 },
        ]}
        ListHeaderComponent={
          <View>
            {/* Smart Favorites Card */}
            <TouchableOpacity
              style={styles.favCard}
              onPress={handlePlayFavorites}
              activeOpacity={0.85}
            >
              <View style={styles.favIconBox}>
                <Heart color={COLORS.black} size={24} fill={COLORS.black} />
              </View>
              <View style={styles.favInfo}>
                <View style={styles.favTitleRow}>
                  <Text style={styles.favTitle} numberOfLines={1}>
                    Músicas Favoritas
                  </Text>
                  <View style={styles.autoBadge}>
                    <Text style={styles.autoBadgeText}>AUTO</Text>
                  </View>
                </View>
                <Text style={styles.favSub}>
                  {favoriteTracks.length}{' '}
                  {favoriteTracks.length === 1 ? 'música' : 'músicas'}
                </Text>
              </View>
              <View style={styles.favPlayCircle}>
                <Play color={COLORS.black} size={17} fill={COLORS.black} />
              </View>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Suas Playlists</Text>
              <TouchableOpacity
                style={styles.sortBtn}
                onPress={() => setSortAlpha((prev) => !prev)}
              >
                <Text style={styles.sortText}>
                  {sortAlpha ? 'A–Z' : 'Recentes'}
                </Text>
                <ArrowUpDown color={COLORS.textSecondary} size={13} />
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <ListMusic color={COLORS.textMuted} size={42} />
            <Text style={styles.emptyTitle}>Nenhuma playlist personalizada</Text>
            <Text style={styles.emptySubtitle}>
              Toque em "+ Nova" para organizar suas músicas por humor, treino ou estilo.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const firstTrack = libraryTracks.find((t) => item.trackUris.includes(t.uri));
          const art = getTrackArtwork(firstTrack);
          return (
            <TouchableOpacity
              style={styles.playlistCard}
              onPress={() => setSelectedPlaylist(item)}
            >
              {art ? (
                <Image source={{ uri: art }} style={styles.playlistArt} />
              ) : (
                <View style={styles.playlistIcon}>
                  <ListMusic color={COLORS.primary} size={22} />
                </View>
              )}

              <View style={styles.playlistInfo}>
                <Text style={styles.playlistTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.playlistSub}>
                  {item.trackUris.length}{' '}
                  {item.trackUris.length === 1 ? 'música' : 'músicas'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.playBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePlayPlaylist(item);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Tocar playlist ${item.name}`}
              >
                <Play color={COLORS.black} size={15} fill={COLORS.black} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  confirmDeletePlaylist(item);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Excluir playlist ${item.name}`}
              >
                <Trash2 color={COLORS.danger} size={18} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      <CreatePlaylistModal
        visible={isCreateVisible}
        onClose={() => setIsCreateVisible(false)}
      />
      <PlaylistDetailModal
        playlist={selectedPlaylist}
        onClose={() => setSelectedPlaylist(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
  },
  countBadge: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  newBtnText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: 6,
  },
  favCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 185, 84, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 18,
  },
  favIconBox: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  favInfo: {
    flex: 1,
    marginRight: 10,
  },
  favTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  autoBadge: {
    backgroundColor: COLORS.primaryDim,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  autoBadgeText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
  },
  favSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  favPlayCircle: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  sortText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    marginTop: 4,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playlistArt: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    marginRight: 12,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  playlistInfo: {
    flex: 1,
    marginRight: 8,
  },
  playlistTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  playlistSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  deleteBtn: {
    padding: 8,
  },
});
