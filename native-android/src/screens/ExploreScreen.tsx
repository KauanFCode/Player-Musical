import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check,
  Download,
  Flame,
  Music,
  Play,
  RefreshCw,
  Search,
  X,
} from 'lucide-react-native';
import { usePlayer } from '../context/PlayerContext';
import {
  downloadTrackOffline,
  fetchSyncedLyrics,
  fetchTrendingTracks,
  searchOnlineTracks,
} from '../services/onlineMusicService';
import { cacheArtworkFromUri, cacheTrackLyrics } from '../utils/assetCache';
import { formatTime } from '../utils/lrcParser';
import { COLORS, RADIUS, SPACING } from '../theme/theme';
import { AudioTrack, OnlineTrack } from '../types/music';

const GENRES = [
  { label: 'Em Alta', value: '' },
  { label: 'Electronic', value: 'Electronic' },
  { label: 'Hip-Hop/Rap', value: 'Hip-Hop/Rap' },
  { label: 'Pop', value: 'Pop' },
  { label: 'Rock', value: 'Rock' },
  { label: 'Lo-Fi', value: 'Lo-Fi' },
];

export default function ExploreScreen() {
  const { addTracksToLibrary, playTrack, libraryTracks, currentTrack, setPlayerModalVisible } =
    usePlayer();

  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [tracks, setTracks] = useState<OnlineTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadedIds, setDownloadedIds] = useState<Record<string, boolean>>({});

  const loadTrending = useCallback(async (genre: string) => {
    setIsLoading(true);
    try {
      const data = await fetchTrendingTracks(genre || undefined);
      setTracks(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      const clean = query.trim();
      if (!clean) {
        setActiveSearchQuery('');
        loadTrending(selectedGenre);
        return;
      }
      setActiveSearchQuery(clean);
      setIsLoading(true);
      try {
        const data = await searchOnlineTracks(clean);
        setTracks(data);
      } finally {
        setIsLoading(false);
      }
    },
    [loadTrending, selectedGenre]
  );

  useEffect(() => {
    if (!activeSearchQuery) {
      loadTrending(selectedGenre);
    }
  }, [selectedGenre, activeSearchQuery, loadTrending]);

  const handleSelectGenre = (value: string) => {
    setSearchInput('');
    setActiveSearchQuery('');
    if (value === selectedGenre) {
      loadTrending(value);
    } else {
      setSelectedGenre(value);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearchQuery('');
    loadTrending(selectedGenre);
  };

  const handlePlay = async (item: OnlineTrack) => {
    const lrc = await fetchSyncedLyrics(item.title, item.artist);
    if (lrc) {
      await cacheTrackLyrics(item.title, item.artist, lrc, item.album);
    }

    const audioTrack: AudioTrack = {
      id: item.streamUrl,
      uri: item.streamUrl,
      name: item.title,
      artist: item.artist,
      album: item.album,
      artworkUrl: item.artworkUrl,
      durationMs: item.durationMs,
    };

    addTracksToLibrary(
      [audioTrack],
      item.artworkUrl ? { [audioTrack.uri]: item.artworkUrl } : undefined,
      lrc ? { [audioTrack.uri]: lrc } : undefined
    );
    await playTrack(audioTrack, [audioTrack, ...libraryTracks]);
    setPlayerModalVisible(true);
  };

  const handleDownload = async (item: OnlineTrack) => {
    setDownloadingId(item.id);
    try {
      const localUri = await downloadTrackOffline(item);
      const cachedArt = item.artworkUrl
        ? await cacheArtworkFromUri(item.title, item.artist, item.artworkUrl, item.album)
        : undefined;
      const lrc = await fetchSyncedLyrics(item.title, item.artist);
      if (lrc) {
        await cacheTrackLyrics(item.title, item.artist, lrc, item.album);
      }

      const audioTrack: AudioTrack = {
        id: localUri,
        uri: localUri,
        name: item.title,
        artist: item.artist,
        album: item.album,
        artworkUrl: cachedArt || item.artworkUrl,
        durationMs: item.durationMs,
        isOfflineDownloaded: true,
        addedAt: Date.now(),
      };

      addTracksToLibrary(
        [audioTrack],
        audioTrack.artworkUrl ? { [localUri]: audioTrack.artworkUrl } : undefined,
        lrc ? { [localUri]: lrc } : undefined
      );
      setDownloadedIds((prev) => ({ ...prev, [item.id]: true }));
      Alert.alert('Baixada', `"${item.title}" salva para ouvir offline!`);
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível baixar esta música.');
    } finally {
      setDownloadingId(null);
    }
  };

  const isTrackDownloaded = (item: OnlineTrack) =>
    Boolean(downloadedIds[item.id]) ||
    libraryTracks.some(
      (t) =>
        t.isOfflineDownloaded &&
        t.name.toLowerCase() === item.title.toLowerCase() &&
        (t.artist || '').toLowerCase() === item.artist.toLowerCase()
    );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DESCOBRIR ONLINE</Text>
          <Text style={styles.title}>Explorar</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() =>
            activeSearchQuery ? runSearch(activeSearchQuery) : loadTrending(selectedGenre)
          }
          accessibilityLabel="Atualizar"
        >
          <RefreshCw color={COLORS.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search color={COLORS.textMuted} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar música ou artista online..."
            placeholderTextColor={COLORS.textMuted}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => runSearch(searchInput)}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn}>
              <X color={COLORS.textMuted} size={16} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.searchGoBtn}
            onPress={() => runSearch(searchInput)}
          >
            <Text style={styles.searchGoText}>Buscar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreRow}
        >
          {GENRES.map((g) => {
            const active = !activeSearchQuery && selectedGenre === g.value;
            return (
              <TouchableOpacity
                key={g.label}
                style={[styles.genreChip, active && styles.genreChipActive]}
                onPress={() => handleSelectGenre(g.value)}
              >
                <Text style={[styles.genreText, active && styles.genreTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {activeSearchQuery ? (
        <View style={styles.statusRow}>
          <Text style={styles.statusText} numberOfLines={1}>
            Resultados para "{activeSearchQuery}"
          </Text>
          <TouchableOpacity onPress={handleClearSearch}>
            <Text style={styles.clearStatusText}>Limpar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.statusRow}>
          <View style={styles.trendingTag}>
            <Flame color={COLORS.primary} size={14} />
            <Text style={styles.trendingTagText}>
              {selectedGenre ? `Em Alta • ${selectedGenre}` : 'Em Alta Agora'}
            </Text>
          </View>
          <Text style={styles.countMeta}>{tracks.length} faixas</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>
            {activeSearchQuery ? 'Buscando músicas online...' : 'Carregando músicas em alta...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: currentTrack ? 120 : 28 },
          ]}
          ListEmptyComponent={
            <View style={styles.centerBox}>
              <Music color={COLORS.textMuted} size={40} />
              <Text style={styles.emptyTitle}>Nenhuma faixa encontrada</Text>
              <Text style={styles.loadingText}>
                {activeSearchQuery
                  ? 'Tente outro nome de música ou artista.'
                  : 'Nenhuma faixa encontrada no momento. Verifique sua conexão.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const isDownloading = downloadingId === item.id;
            const isDone = isTrackDownloaded(item);
            return (
              <TouchableOpacity style={styles.card} onPress={() => handlePlay(item)}>
                {!activeSearchQuery && <Text style={styles.rank}>{index + 1}</Text>}
                <Image source={{ uri: item.artworkUrl }} style={styles.art} />
                <View style={styles.info}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.metaLine}>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {item.artist}
                      {item.durationMs ? ` • ${formatTime(item.durationMs)}` : ''}
                    </Text>
                    <View style={styles.onlineBadge}>
                      <Text style={styles.onlineBadgeText}>ONLINE</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity style={styles.iconBtn} onPress={() => handlePlay(item)}>
                  <Play color={COLORS.primary} size={18} fill={COLORS.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleDownload(item)}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : isDone ? (
                    <Check color={COLORS.primary} size={18} />
                  ) : (
                    <Download color={COLORS.text} size={18} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  eyebrow: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 4,
  },
  clearBtn: {
    padding: 4,
  },
  searchGoBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  searchGoText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: '800',
  },
  genreRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  genreChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  genreText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  genreTextActive: {
    color: COLORS.black,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 6,
  },
  statusText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginRight: 10,
  },
  clearStatusText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  trendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendingTagText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  countMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
    paddingBottom: 140,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rank: {
    width: 24,
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  art: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.sm,
    marginHorizontal: 8,
    backgroundColor: COLORS.surfaceElevated,
  },
  info: {
    flex: 1,
    marginRight: 6,
  },
  trackTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  trackArtist: {
    flexShrink: 1,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  onlineBadge: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  onlineBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: '800',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
