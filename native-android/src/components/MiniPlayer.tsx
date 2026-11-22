import React, { useMemo, useRef } from 'react';
import {
  Image,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Music, Pause, Play, SkipForward } from 'lucide-react-native';
import { usePlaybackProgress, usePlayer } from '../context/PlayerContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../theme/theme';

export const MiniPlayer: React.FC = () => {
  const insets = useSafeAreaInsets();
  const {
    currentTrack,
    isPlaying,
    getTrackArtwork,
    togglePlayPause,
    playNext,
    playPrevious,
    setPlayerModalVisible,
  } = usePlayer();
  const { positionMs, durationMs } = usePlaybackProgress();

  const playNextRef = useRef(playNext);
  const playPrevRef = useRef(playPrevious);
  playNextRef.current = playNext;
  playPrevRef.current = playPrevious;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -55) {
            playNextRef.current();
          } else if (gesture.dx > 55) {
            playPrevRef.current();
          }
        },
      }),
    []
  );

  if (!currentTrack) return null;

  const artworkUri = getTrackArtwork(currentTrack);
  const progressPct =
    durationMs > 0 ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100)) : 0;

  return (
    <View
      style={[styles.container, { bottom: 66 + insets.bottom }]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => setPlayerModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Abrir player: ${currentTrack.name}`}
      >
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>

        <View style={styles.row}>
          {artworkUri ? (
            <Image source={{ uri: artworkUri }} style={styles.artwork} />
          ) : (
            <View style={styles.artworkPlaceholder}>
              <Music color={COLORS.primary} size={20} />
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.name}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist || 'Artista Desconhecido'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={(e) => {
              e.stopPropagation();
              togglePlayPause();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pausar' : 'Tocar'}
          >
            {isPlaying ? (
              <Pause color={COLORS.primary} size={22} fill={COLORS.primary} />
            ) : (
              <Play color={COLORS.primary} size={22} fill={COLORS.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={(e) => {
              e.stopPropagation();
              playNext();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Próxima música"
          >
            <SkipForward color={COLORS.text} size={20} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    bottom: 66,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.floating,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: COLORS.border,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    marginRight: 12,
  },
  artworkPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  artist: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  controlBtn: {
    padding: 8,
  },
});
