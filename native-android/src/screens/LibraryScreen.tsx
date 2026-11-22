import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  FolderPlus,
  Heart,
  HelpCircle,
  ListPlus,
  MoreVertical,
  Music,
  Play,
  Plus,
  Search,
  Settings,
  Shuffle,
  Trash2,
  Zap,
} from 'lucide-react-native';
import { usePlayer } from '../context/PlayerContext';
import { SettingsModal } from '../components/SettingsModal';
import { HelpModal } from '../components/HelpModal';
import {
  AddToPlaylistModal,
  CreatePlaylistModal,
} from '../components/PlaylistModals';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../theme/theme';
import { AudioTrack } from '../types/music';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const {
    libraryTracks,
    favoriteUris,
    watchedFolders,
    currentTrack,
    isStorageLoaded,
    isScanningFolders,
    getTrackArtwork,
    playTrack,
    playQueue,
    playNextInQueue,
    addToQueue,
    isFavorite,
    toggleFavorite,
    importFolder,
    syncWatchedFolders,
    removeTrackFromLibrary,
    setPlayerModalVisible,
  } = usePlayer();

  const [trackFilter, setTrackFilter] = useState<'all' | 'favorites' | 'offline'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [trackMenuTarget, setTrackMenuTarget] = useState<AudioTrack | null>(null);
  const [isCreatePlaylistVisible, setIsCreatePlaylistVisible] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] = useState<AudioTrack | null>(null);
  const [isAddToPlaylistVisible, setIsAddToPlaylistVisible] = useState(false);

  const filteredTracks = useMemo(() => {
    let base = libraryTracks;
    if (trackFilter === 'favorites') {
      base = libraryTracks.filter((t) => favoriteUris.includes(t.uri));
    } else if (trackFilter === 'offline') {
      base = libraryTracks.filter((t) => !t.uri.startsWith('http'));
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [favoriteUris, libraryTracks, searchQuery, trackFilter]);

  const confirmDeleteTrack = (track: AudioTrack) => {
    Alert.alert('Remover Música', `Deseja remover "${track.name}" da biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => removeTrackFromLibrary(track.uri),
      },
    ]);
  };

  const handleShufflePlayAll = async () => {
    if (filteredTracks.length === 0) return;
    const randomIdx = Math.floor(Math.random() * filteredTracks.length);
    await playQueue(filteredTracks, randomIdx);
    setPlayerModalVisible(true);
  };

  const isFirstRunEmpty =
    isStorageLoaded && libraryTracks.length === 0 && watchedFolders.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {!isStorageLoaded ? (
        <View style={styles.loadingStateBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : isFirstRunEmpty ? (
        /* First-launch clean onboarding view */
        <View style={styles.onboardingRoot}>
          <View style={styles.onboardingHeader}>
            <Text style={styles.brandWordmark}>Player 2.0</Text>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => setIsSettingsVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Configurações"
            >
              <Settings color={COLORS.textSecondary} size={22} />
            </TouchableOpacity>
          </View>

          <View style={styles.onboardingCenter}>
            <View style={styles.heroGlowRing}>
              <View style={styles.heroCircle}>
                <FolderPlus color={COLORS.black} size={36} />
              </View>
            </View>

            <Text style={styles.heroTitle}>Suas músicas, offline</Text>
            <Text style={styles.heroSubtitle}>
              Selecione a pasta onde você salva suas músicas. Novas faixas
              adicionadas lá aparecerão automaticamente.
            </Text>

            <TouchableOpacity
              style={styles.selectFolderCta}
              onPress={importFolder}
              disabled={isScanningFolders}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Selecionar Pasta"
            >
              {isScanningFolders ? (
                <ActivityIndicator size="small" color={COLORS.black} />
              ) : (
                <FolderPlus color={COLORS.black} size={20} />
              )}
              <Text style={styles.selectFolderCtaText}>
                {isScanningFolders ? 'Escaneando pasta...' : 'Selecionar Pasta'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exploreLinkBtn}
              onPress={() => navigation.navigate('Explorar')}
            >
              <Text style={styles.exploreLinkText}>Explorar músicas online</Text>
            </TouchableOpacity>

            <View style={styles.infoBanner}>
              <View style={styles.infoIconBox}>
                <Zap color={COLORS.primary} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBannerTitle}>Sincronização instantânea</Text>
                <Text style={styles.infoBannerSub}>
                  MP3, FLAC, WAV e AAC prontos para tocar em segundo plano
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Clean Library View */
        <View style={{ flex: 1 }}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              Biblioteca
            </Text>
            <View style={styles.headerIcons}>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => {
                  setIsSearching((prev) => !prev);
                  if (isSearching) setSearchQuery('');
                }}
                accessibilityRole="button"
                accessibilityLabel="Buscar na biblioteca"
              >
                <Search
                  color={isSearching ? COLORS.primary : COLORS.textSecondary}
                  size={21}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setIsHelpVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Ajuda"
              >
                <HelpCircle color={COLORS.textSecondary} size={21} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerIconBtn}
                onPress={() => setIsSettingsVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Configurações"
              >
                <Settings color={COLORS.textSecondary} size={21} />
              </TouchableOpacity>
            </View>
          </View>

          {isSearching && (
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Filtrar por título, artista ou álbum..."
                placeholderTextColor={COLORS.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
          )}

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {[
              { key: 'all' as const, label: 'Todas' },
              { key: 'favorites' as const, label: `Favoritas (${favoriteUris.length})` },
              { key: 'offline' as const, label: 'Offline' },
            ].map((f) => {
              const active = trackFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setTrackFilter(f.key)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={filteredTracks}
            keyExtractor={(item, idx) => `${item.uri}-${idx}`}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: currentTrack ? 110 : 24 },
            ]}
            ListHeaderComponent={
              filteredTracks.length > 0 ? (
                <View style={styles.quickPlayRow}>
                  <TouchableOpacity
                    style={styles.quickPlayBtn}
                    onPress={async () => {
                      await playQueue(filteredTracks, 0);
                      setPlayerModalVisible(true);
                    }}
                  >
                    <Play color={COLORS.black} size={15} fill={COLORS.black} />
                    <Text style={styles.quickPlayText}>Tocar Tudo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickShuffleBtn}
                    onPress={handleShufflePlayAll}
                  >
                    <Shuffle color={COLORS.text} size={15} />
                    <Text style={styles.quickShuffleText}>Aleatório</Text>
                  </TouchableOpacity>
                  <Text style={styles.trackCountMeta}>
                    {filteredTracks.length}{' '}
                    {filteredTracks.length === 1 ? 'faixa' : 'faixas'}
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Music color={COLORS.textMuted} size={42} />
                <Text style={styles.emptyTitle}>
                  {trackFilter === 'favorites'
                    ? 'Nenhuma música favorita'
                    : 'Nenhuma música encontrada'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {trackFilter === 'favorites'
                    ? 'Toque no coração em qualquer música para adicioná-la aos favoritos.'
                    : 'Coloque arquivos na sua pasta conectada ou altere a pasta nas Configurações.'}
                </Text>
                {watchedFolders.length > 0 && trackFilter === 'all' && (
                  <TouchableOpacity
                    style={styles.emptySyncBtn}
                    onPress={() => syncWatchedFolders(true)}
                  >
                    <Text style={styles.emptySyncBtnText}>Verificar Pasta Agora</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const isCurrent = currentTrack?.uri === item.uri;
              const fav = isFavorite(item.uri);
              const art = getTrackArtwork(item);
              const isFlac = item.name.toLowerCase().includes('flac') || item.uri.toLowerCase().includes('.flac');

              return (
                <TouchableOpacity
                  style={[styles.trackCard, isCurrent && styles.trackCardActive]}
                  onPress={() => playTrack(item, filteredTracks)}
                  onLongPress={() => setTrackMenuTarget(item)}
                >
                  {art ? (
                    <Image source={{ uri: art }} style={styles.trackArt} />
                  ) : (
                    <View style={styles.trackArtPlaceholder}>
                      <Music
                        color={isCurrent ? COLORS.primary : COLORS.textMuted}
                        size={20}
                      />
                    </View>
                  )}

                  <View style={styles.trackInfo}>
                    <View style={styles.trackTitleRow}>
                      <Text
                        style={[styles.trackTitle, isCurrent && styles.trackTitleActive]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {isCurrent && <View style={styles.activeDot} />}
                    </View>

                    <View style={styles.trackSubRow}>
                      {(isFlac || item.isOfflineDownloaded) && (
                        <View style={styles.qualityBadge}>
                          <Text style={styles.qualityBadgeText}>
                            {isFlac ? 'FLAC' : 'OFFLINE'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.trackArtist} numberOfLines={1}>
                        {item.artist}
                        {item.album ? ` • ${item.album}` : ''}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.trackActionBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleFavorite(item.uri);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityRole="button"
                    accessibilityLabel={fav ? 'Desfavoritar' : 'Favoritar'}
                  >
                    <Heart
                      color={fav ? COLORS.primary : COLORS.textMuted}
                      size={18}
                      fill={fav ? COLORS.primary : 'transparent'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.trackActionBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      setTrackMenuTarget(item);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Opções para ${item.name}`}
                  >
                    <MoreVertical color={COLORS.textSecondary} size={18} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {/* Modals */}
      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />
      <HelpModal visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
      <CreatePlaylistModal
        visible={isCreatePlaylistVisible}
        initialTrack={trackForPlaylist}
        onClose={() => {
          setIsCreatePlaylistVisible(false);
          setTrackForPlaylist(null);
        }}
      />
      <AddToPlaylistModal
        visible={isAddToPlaylistVisible}
        track={trackForPlaylist}
        onClose={() => setIsAddToPlaylistVisible(false)}
        onCreateNew={() => setIsCreatePlaylistVisible(true)}
      />

      {/* Track Options Sheet */}
      <Modal
        visible={!!trackMenuTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setTrackMenuTarget(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setTrackMenuTarget(null)}
        >
          {trackMenuTarget && (
            <View
              style={[styles.sheetCard, { paddingBottom: Math.max(24, insets.bottom + 14) }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {trackMenuTarget.name}
              </Text>
              <Text style={styles.sheetSub} numberOfLines={1}>
                {trackMenuTarget.artist}
              </Text>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={async () => {
                  const target = trackMenuTarget;
                  setTrackMenuTarget(null);
                  await playNextInQueue(target);
                }}
              >
                <Play color={COLORS.primary} size={18} />
                <Text style={styles.sheetOptionText}>Tocar a seguir</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={async () => {
                  const target = trackMenuTarget;
                  setTrackMenuTarget(null);
                  await addToQueue(target);
                }}
              >
                <Plus color={COLORS.text} size={18} />
                <Text style={styles.sheetOptionText}>Adicionar à fila</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => {
                  const target = trackMenuTarget;
                  setTrackMenuTarget(null);
                  toggleFavorite(target.uri);
                }}
              >
                <Heart
                  color={COLORS.primary}
                  size={18}
                  fill={isFavorite(trackMenuTarget.uri) ? COLORS.primary : 'transparent'}
                />
                <Text style={styles.sheetOptionText}>
                  {isFavorite(trackMenuTarget.uri)
                    ? 'Remover dos favoritos'
                    : 'Adicionar aos favoritos'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOption}
                onPress={() => {
                  const target = trackMenuTarget;
                  setTrackMenuTarget(null);
                  setTrackForPlaylist(target);
                  setIsAddToPlaylistVisible(true);
                }}
              >
                <ListPlus color={COLORS.text} size={18} />
                <Text style={styles.sheetOptionText}>Adicionar à playlist</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetOption, styles.sheetDangerOption]}
                onPress={() => {
                  const target = trackMenuTarget;
                  setTrackMenuTarget(null);
                  confirmDeleteTrack(target);
                }}
              >
                <Trash2 color={COLORS.danger} size={18} />
                <Text style={styles.sheetDangerText}>Remover da biblioteca</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingStateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingRoot: {
    flex: 1,
  },
  onboardingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  brandWordmark: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  onboardingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 60,
  },
  heroGlowRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(29, 185, 84, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  heroCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: COLORS.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.floating,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 10,
    marginBottom: 28,
  },
  selectFolderCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primaryBright,
    width: '100%',
    paddingVertical: 15,
    borderRadius: RADIUS.full,
    ...SHADOWS.card,
  },
  selectFolderCtaText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '800',
  },
  exploreLinkBtn: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  exploreLinkText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: 14,
    width: '100%',
    marginTop: 28,
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  infoBannerSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: {
    flex: 1,
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    marginRight: 8,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  headerIconBtn: {
    padding: 8,
  },
  searchContainer: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: COLORS.primaryBright,
    borderColor: COLORS.primaryBright,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: COLORS.black,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
  },
  quickPlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  quickPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryBright,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.full,
  },
  quickPlayText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: 13,
  },
  quickShuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
  },
  quickShuffleText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  trackCountMeta: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    marginTop: 12,
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
  emptySyncBtn: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  emptySyncBtnText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 13,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackCardActive: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryDim,
  },
  trackArt: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    marginRight: 12,
  },
  trackArtPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
    marginRight: 6,
  },
  trackTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  trackTitleActive: {
    color: COLORS.primaryBright,
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  trackSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  qualityBadge: {
    backgroundColor: COLORS.primaryDim,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  qualityBadgeText: {
    color: COLORS.primary,
    fontSize: 9.5,
    fontWeight: '800',
  },
  trackArtist: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 12,
  },
  trackActionBtn: {
    padding: 8,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sheetSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  sheetOptionText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sheetDangerOption: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    marginTop: 4,
  },
  sheetDangerText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
