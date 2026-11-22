import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  AlignLeft,
  ChevronDown,
  Heart,
  Image as ImageIcon,
  Languages,
  ListMusic,
  Moon,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Shuffle,
  SkipBack,
  SkipForward,
  Upload,
} from 'lucide-react-native';
import { usePlaybackProgress, usePlayer } from '../context/PlayerContext';
import { MarqueeText } from './MarqueeText';
import {
  formatTime,
  getActiveLyricIndex,
  parseFilename,
  parseLrc,
} from '../utils/lrcParser';
import {
  cacheArtworkFromUri,
  cacheTrackLyrics,
  getCachedLyricsTranslation,
  translateLyricsLines,
} from '../utils/assetCache';
import { getTextFromUri } from '../utils/metadataExtractor';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../theme/theme';
import { LrcLine, LyricFontSize } from '../types/music';

type CenterTab = 'cover' | 'lyrics' | 'queue';

export const PlayerModal: React.FC = () => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompactHeight = windowHeight < 700;

  const {
    isPlayerModalVisible,
    setPlayerModalVisible,
    currentTrack,
    isPlaying,
    queue,
    currentIndex,
    isShuffle,
    repeatMode,
    settings,
    sleepTimer,
    getTrackArtwork,
    resolveLyricsForTrack,
    setTrackCover,
    setTrackLyrics,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    skipForward,
    skipBackward,
    toggleShuffle,
    cycleRepeatMode,
    jumpToQueueIndex,
    isFavorite,
    toggleFavorite,
    getLyricOffset,
    adjustLyricOffset,
    resetLyricOffset,
    setSleepTimerMinutes,
    setSleepTimerEndOfTrack,
    cancelSleepTimer,
    updateSettings,
  } = usePlayer();
  const { positionMs, durationMs } = usePlaybackProgress();

  const [centerTab, setCenterTab] = useState<CenterTab>('cover');
  const [centerHeight, setCenterHeight] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isSleepModalVisible, setIsSleepModalVisible] = useState(false);
  const [sleepRemainingSec, setSleepRemainingSec] = useState(0);

  const [parsedLyrics, setParsedLyrics] = useState<LrcLine[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);
  const [translatedLines, setTranslatedLines] = useState<string[] | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const lyricsScrollRef = useRef<ScrollView>(null);
  const lineLayoutsRef = useRef<Record<number, { y: number; height: number }>>({});
  const lyricsViewportHeightRef = useRef(360);
  const [lyricsScrollHeight, setLyricsScrollHeight] = useState(340);

  // Pulse animation for cover art
  const coverScale = useSharedValue(1);
  useEffect(() => {
    if (isPlaying && settings.pulseCoverAnimation && centerTab === 'cover') {
      coverScale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 1400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(coverScale);
      coverScale.value = withTiming(1, { duration: 250 });
    }
  }, [isPlaying, settings.pulseCoverAnimation, centerTab, coverScale]);

  const coverAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverScale.value }],
  }));

  // Load lyrics whenever currentTrack changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentTrack) {
        setParsedLyrics([]);
        setActiveLyricIdx(-1);
        setTranslatedLines(null);
        setShowTranslation(false);
        return;
      }
      setIsLoadingLyrics(true);
      lineLayoutsRef.current = {};
      setActiveLyricIdx(-1);
      setTranslatedLines(null);
      setShowTranslation(false);
      setIsTranslating(false);
      try {
        const raw = await resolveLyricsForTrack(currentTrack);
        if (cancelled) return;
        if (raw) {
          const lines = parseLrc(raw);
          setParsedLyrics(lines);
          const parsed = parseFilename(currentTrack.name);
          const cachedTranslation = await getCachedLyricsTranslation(
            parsed.title || currentTrack.name,
            currentTrack.artist || parsed.artist,
            currentTrack.album
          );
          if (!cancelled && cachedTranslation && cachedTranslation.length === lines.length) {
            setTranslatedLines(cachedTranslation);
          }
        } else {
          setParsedLyrics([]);
        }
      } finally {
        if (!cancelled) setIsLoadingLyrics(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, resolveLyricsForTrack]);

  const currentLyricOffset = currentTrack ? getLyricOffset(currentTrack.uri) : 0;

  // Live countdown display for Sleep Timer only when modal is visible
  useEffect(() => {
    if (!isPlayerModalVisible || !sleepTimer.endTimeMs) {
      setSleepRemainingSec(0);
      return;
    }
    const updateRemaining = () => {
      const rem = Math.max(0, Math.ceil((sleepTimer.endTimeMs! - Date.now()) / 1000));
      setSleepRemainingSec(rem);
    };
    updateRemaining();
    const id = setInterval(updateRemaining, 1000);
    return () => clearInterval(id);
  }, [isPlayerModalVisible, sleepTimer.endTimeMs]);

  // Sync active lyric line
  useEffect(() => {
    if (parsedLyrics.length > 0 && !isSeeking) {
      const idx = getActiveLyricIndex(parsedLyrics, positionMs + currentLyricOffset, 350);
      if (idx !== activeLyricIdx) {
        setActiveLyricIdx(idx);
        if (centerTab === 'lyrics' && idx >= 0) {
          const layout = lineLayoutsRef.current[idx];
          const viewportH = lyricsScrollHeight || lyricsViewportHeightRef.current;
          if (layout && lyricsScrollRef.current) {
            const targetY = Math.max(
              0,
              layout.y + layout.height / 2 - viewportH / 2
            );
            lyricsScrollRef.current.scrollTo({ y: targetY, animated: true });
          }
        }
      }
    }
  }, [
    positionMs,
    currentLyricOffset,
    parsedLyrics,
    isSeeking,
    activeLyricIdx,
    centerTab,
    lyricsScrollHeight,
  ]);

  // Center active line when switching into Lyrics tab or toggling translation
  useEffect(() => {
    if (centerTab !== 'lyrics' || activeLyricIdx < 0) return;
    const timer = setTimeout(() => {
      const layout = lineLayoutsRef.current[activeLyricIdx];
      const viewportH = lyricsScrollHeight || lyricsViewportHeightRef.current;
      if (layout && lyricsScrollRef.current) {
        const targetY = Math.max(0, layout.y + layout.height / 2 - viewportH / 2);
        lyricsScrollRef.current.scrollTo({ y: targetY, animated: true });
      }
    }, 90);
    return () => clearTimeout(timer);
  }, [centerTab, showTranslation, lyricsScrollHeight, activeLyricIdx]);

  const handleToggleTranslation = async () => {
    if (!currentTrack || parsedLyrics.length === 0) return;
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translatedLines && translatedLines.length === parsedLyrics.length) {
      setShowTranslation(true);
      return;
    }
    setIsTranslating(true);
    try {
      const parsed = parseFilename(currentTrack.name);
      const translated = await translateLyricsLines(
        parsed.title || currentTrack.name,
        currentTrack.artist || parsed.artist,
        parsedLyrics.map((l) => l.text),
        currentTrack.album
      );
      setTranslatedLines(translated);
      setShowTranslation(true);
    } catch {
      // Silently ignore offline translation failure
    } finally {
      setIsTranslating(false);
    }
  };

  const handlePickCover = async () => {
    if (!currentTrack) return;
    try {
      const [res] = await pick({
        type: [types.images],
      });
      if (!res) return;
      const parsed = parseFilename(currentTrack.name);
      const cached = await cacheArtworkFromUri(
        parsed.title || currentTrack.name,
        currentTrack.artist || parsed.artist,
        res.uri,
        currentTrack.album
      );
      setTrackCover(currentTrack.uri, cached);
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) console.warn(e);
    }
  };

  const handlePickLyrics = async () => {
    if (!currentTrack) return;
    try {
      const [res] = await pick({
        type: [types.allFiles],
      });
      if (!res) return;
      const text = await getTextFromUri(res.uri);
      if (text?.trim()) {
        const parsed = parseFilename(currentTrack.name);
        await cacheTrackLyrics(
          parsed.title || currentTrack.name,
          currentTrack.artist || parsed.artist,
          text,
          currentTrack.album
        );
        setTrackLyrics(currentTrack.uri, text);
        setParsedLyrics(parseLrc(text));
        setTranslatedLines(null);
        setShowTranslation(false);
      }
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) console.warn(e);
    }
  };

  const artworkUri = getTrackArtwork(currentTrack);
  const displayPos = isSeeking ? seekValue : positionMs;
  const maxDuration = durationMs > 0 ? durationMs : 1;

  const lyricFontSizeMap: Record<LyricFontSize, number> = {
    small: 17,
    medium: 21,
    large: 26,
  };
  const baseLyricFont = lyricFontSizeMap[settings.lyricFontSize] || 21;
  const activeLyricFont = baseLyricFont + 4;
  const fontScaleOrder: LyricFontSize[] = ['small', 'medium', 'large'];
  const currentFontIdx = Math.max(0, fontScaleOrder.indexOf(settings.lyricFontSize));
  const stepLyricFont = (dir: -1 | 1) => {
    const nextIdx = Math.max(0, Math.min(fontScaleOrder.length - 1, currentFontIdx + dir));
    updateSettings({ lyricFontSize: fontScaleOrder[nextIdx] });
  };
  const currentFav = currentTrack ? isFavorite(currentTrack.uri) : false;
  const isSleepActive = !!sleepTimer.endTimeMs || sleepTimer.untilTrackEnd;
  const sleepChipLabel = sleepTimer.untilTrackEnd
    ? 'Fim faixa'
    : sleepTimer.endTimeMs
      ? formatTime(sleepRemainingSec * 1000)
      : 'Timer';
  const offsetLabel =
    currentLyricOffset === 0
      ? '0.0s'
      : `${currentLyricOffset > 0 ? '+' : ''}${(currentLyricOffset / 1000).toFixed(1)}s`;

  const coverSize = Math.max(
    140,
    Math.min(
      windowWidth * 0.8,
      centerHeight > 0 ? centerHeight - 68 : windowHeight * 0.42,
      360
    )
  );

  return (
    <Modal
      visible={isPlayerModalVisible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => setPlayerModalVisible(false)}
    >
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => setPlayerModalVisible(false)}
              style={styles.headerIconBtn}
            >
              <ChevronDown color={COLORS.text} size={28} />
            </TouchableOpacity>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>TOCANDO AGORA</Text>
            {currentTrack?.album ? (
              <Text style={styles.headerAlbum} numberOfLines={1}>
                {currentTrack.album}
              </Text>
            ) : null}
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[
                styles.headerPillBtn,
                centerTab === 'queue' && styles.headerPillBtnActive,
              ]}
              onPress={() =>
                setCenterTab((prev) => (prev === 'queue' ? 'cover' : 'queue'))
              }
            >
              <ListMusic
                color={centerTab === 'queue' ? COLORS.black : COLORS.text}
                size={19}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerPillBtn,
                centerTab === 'lyrics' && styles.headerPillBtnActive,
              ]}
              onPress={() =>
                setCenterTab((prev) => (prev === 'lyrics' ? 'cover' : 'lyrics'))
              }
            >
              <AlignLeft
                color={centerTab === 'lyrics' ? COLORS.black : COLORS.text}
                size={19}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Center Content */}
        <View
          style={styles.centerContent}
          onLayout={(e) => setCenterHeight(e.nativeEvent.layout.height)}
        >
          {centerTab === 'cover' && (
            <View style={styles.coverWrapper}>
              <Animated.View
                style={[
                  styles.coverCard,
                  { width: coverSize, height: coverSize },
                  coverAnimatedStyle,
                ]}
              >
                {artworkUri ? (
                  <Image source={{ uri: artworkUri }} style={styles.coverImage} />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Music color={COLORS.textMuted} size={Math.round(coverSize * 0.28)} />
                  </View>
                )}
              </Animated.View>

              <View style={[styles.coverQuickActions, isCompactHeight && { marginTop: 10 }]}>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={handlePickCover}
                  accessibilityRole="button"
                  accessibilityLabel="Alterar capa"
                >
                  <ImageIcon color={COLORS.textSecondary} size={14} />
                  <Text style={styles.quickChipText}>Capa</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={handlePickLyrics}
                  accessibilityRole="button"
                  accessibilityLabel="Importar arquivo LRC"
                >
                  <Upload color={COLORS.textSecondary} size={14} />
                  <Text style={styles.quickChipText}>.LRC</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickChip, isSleepActive && styles.quickChipActive]}
                  onPress={() => setIsSleepModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Configurar temporizador de desligamento"
                >
                  <Moon
                    color={isSleepActive ? COLORS.primary : COLORS.textSecondary}
                    size={14}
                  />
                  <Text
                    style={[
                      styles.quickChipText,
                      isSleepActive && styles.quickChipTextActive,
                    ]}
                  >
                    {sleepChipLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {centerTab === 'lyrics' && (
            <View
              style={styles.lyricsWrapper}
              onLayout={(e) => {
                lyricsViewportHeightRef.current = e.nativeEvent.layout.height;
              }}
            >
              {/* Quick Font, Sync Offset & Translate Toolbar */}
              <View style={styles.lyricsToolbar}>
                <View style={styles.lyricsToolGroup}>
                  <TouchableOpacity
                    style={[styles.lyricsToolBtn, currentFontIdx === 0 && styles.lyricsToolBtnDisabled]}
                    onPress={() => stepLyricFont(-1)}
                    disabled={currentFontIdx === 0}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir fonte da letra"
                  >
                    <Text style={styles.lyricsToolBtnText}>A-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.lyricsToolBtn,
                      currentFontIdx === fontScaleOrder.length - 1 && styles.lyricsToolBtnDisabled,
                    ]}
                    onPress={() => stepLyricFont(1)}
                    disabled={currentFontIdx === fontScaleOrder.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar fonte da letra"
                  >
                    <Text style={styles.lyricsToolBtnText}>A+</Text>
                  </TouchableOpacity>
                </View>

                {currentTrack && (
                  <View style={styles.lyricsToolGroup}>
                    <TouchableOpacity
                      style={styles.lyricsToolBtn}
                      onPress={() => adjustLyricOffset(currentTrack.uri, -500)}
                      accessibilityRole="button"
                      accessibilityLabel="Atrasar letra em meio segundo"
                    >
                      <Text style={styles.lyricsToolBtnText}>-0.5s</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.lyricsOffsetPill,
                        currentLyricOffset !== 0 && styles.lyricsOffsetPillActive,
                      ]}
                      onPress={() => resetLyricOffset(currentTrack.uri)}
                      accessibilityRole="button"
                      accessibilityLabel="Zerar ajuste de sincronia da letra"
                    >
                      <Text
                        style={[
                          styles.lyricsOffsetText,
                          currentLyricOffset !== 0 && styles.lyricsOffsetTextActive,
                        ]}
                      >
                        {offsetLabel}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.lyricsToolBtn}
                      onPress={() => adjustLyricOffset(currentTrack.uri, 500)}
                      accessibilityRole="button"
                      accessibilityLabel="Adiantar letra em meio segundo"
                    >
                      <Text style={styles.lyricsToolBtnText}>+0.5s</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.translateBtn,
                    showTranslation && styles.translateBtnActive,
                    parsedLyrics.length === 0 && styles.lyricsToolBtnDisabled,
                  ]}
                  onPress={handleToggleTranslation}
                  disabled={isTranslating || parsedLyrics.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Traduzir letra para português"
                >
                  {isTranslating ? (
                    <ActivityIndicator
                      size="small"
                      color={showTranslation ? COLORS.black : COLORS.primary}
                    />
                  ) : (
                    <>
                      <Languages
                        color={showTranslation ? COLORS.black : COLORS.primary}
                        size={14}
                      />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.translateBtnText,
                          showTranslation && styles.translateBtnTextActive,
                        ]}
                      >
                        {showTranslation ? 'PT-BR' : 'Traduzir'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {isLoadingLyrics ? (
                <View style={styles.centerFallback}>
                  <ActivityIndicator color={COLORS.primary} size="large" />
                  <Text style={styles.fallbackText}>Buscando letra...</Text>
                </View>
              ) : parsedLyrics.length === 0 ? (
                <View style={styles.centerFallback}>
                  <AlignLeft color={COLORS.textMuted} size={40} />
                  <Text style={styles.fallbackText}>Nenhuma letra encontrada.</Text>
                  <TouchableOpacity style={styles.importLrcBtn} onPress={handlePickLyrics}>
                    <Upload color={COLORS.black} size={16} />
                    <Text style={styles.importLrcText}>Importar arquivo .LRC</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  ref={lyricsScrollRef}
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (h > 0) setLyricsScrollHeight(h);
                  }}
                  contentContainerStyle={[
                    styles.lyricsScrollContent,
                    {
                      paddingVertical: Math.max(96, Math.round(lyricsScrollHeight * 0.4)),
                    },
                  ]}
                  showsVerticalScrollIndicator={false}
                >
                  {parsedLyrics.map((line, i) => {
                    const isActive = i === activeLyricIdx;
                    const translatedLine =
                      showTranslation && translatedLines?.[i]
                        ? translatedLines[i].trim()
                        : '';
                    const shouldRenderTranslation =
                      Boolean(translatedLine) &&
                      translatedLine.toLowerCase() !== line.text.trim().toLowerCase();
                    return (
                      <TouchableOpacity
                        key={`${i}-${line.timeMs}`}
                        style={styles.lyricBlock}
                        activeOpacity={line.timeMs >= 0 ? 0.6 : 1}
                        onPress={() => {
                          if (line.timeMs >= 0) {
                            seekTo(Math.max(0, line.timeMs - currentLyricOffset));
                          }
                        }}
                        onLayout={(e) => {
                          lineLayoutsRef.current[i] = {
                            y: e.nativeEvent.layout.y,
                            height: e.nativeEvent.layout.height,
                          };
                        }}
                      >
                        <Text
                          style={[
                            styles.lyricLine,
                            {
                              fontSize: baseLyricFont,
                              lineHeight: Math.round(baseLyricFont * 1.48),
                            },
                            isActive && [
                              styles.lyricLineActive,
                              {
                                fontSize: activeLyricFont,
                                lineHeight: Math.round(activeLyricFont * 1.42),
                              },
                            ],
                          ]}
                        >
                          {line.text}
                        </Text>
                        {shouldRenderTranslation && (
                          <Text
                            style={[
                              styles.lyricTranslation,
                              {
                                fontSize: Math.max(13, baseLyricFont - 4),
                                lineHeight: Math.round(Math.max(13, baseLyricFont - 4) * 1.4),
                              },
                              isActive && styles.lyricTranslationActive,
                            ]}
                          >
                            {translatedLine}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

          {centerTab === 'queue' && (
            <FlatList
              data={queue}
              keyExtractor={(item, index) => `${item.uri}-${index}`}
              contentContainerStyle={styles.queueContent}
              ListHeaderComponent={
                <Text style={styles.queueHeading}>
                  Fila de Reprodução ({queue.length})
                </Text>
              }
              renderItem={({ item, index }) => {
                const isCurrent = index === currentIndex;
                const art = getTrackArtwork(item);
                return (
                  <TouchableOpacity
                    style={[styles.queueItem, isCurrent && styles.queueItemActive]}
                    onPress={() => jumpToQueueIndex(index)}
                  >
                    {art ? (
                      <Image source={{ uri: art }} style={styles.queueArt} />
                    ) : (
                      <View style={styles.queueArtPlaceholder}>
                        <Music
                          color={isCurrent ? COLORS.primary : COLORS.textMuted}
                          size={16}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.queueTitle, isCurrent && styles.queueTitleActive]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.queueArtist} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* Bottom Controls */}
        <View style={[styles.controlsArea, isCompactHeight && { paddingBottom: SPACING.sm, paddingTop: 4 }]}>
          <View style={styles.titleHeartRow}>
            <View style={styles.titleSpacer} />
            <View style={{ flex: 1 }}>
              <MarqueeText
                text={currentTrack?.name || 'Nenhuma faixa'}
                style={[styles.trackTitle, isCompactHeight && { fontSize: 19 }]}
              />
              <Text style={styles.trackArtist} numberOfLines={1}>
                {currentTrack?.artist || 'Artista Desconhecido'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.titleHeartBtn}
              onPress={() => currentTrack && toggleFavorite(currentTrack.uri)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={currentFav ? 'Remover dos favoritos' : 'Favoritar música'}
            >
              <Heart
                color={currentFav ? COLORS.primary : COLORS.textSecondary}
                size={22}
                fill={currentFav ? COLORS.primary : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          {/* Slider */}
          <View style={styles.sliderSection}>
            <Slider
              style={styles.slider}
              value={Math.min(displayPos, maxDuration)}
              minimumValue={0}
              maximumValue={maxDuration}
              minimumTrackTintColor={COLORS.primary}
              maximumTrackTintColor={COLORS.border}
              thumbTintColor={COLORS.primary}
              onSlidingStart={() => {
                setIsSeeking(true);
                setSeekValue(positionMs);
              }}
              onValueChange={(val) => setSeekValue(val)}
              onSlidingComplete={async (val) => {
                await seekTo(val);
                setIsSeeking(false);
              }}
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(displayPos)}</Text>
              <Text style={styles.timeText}>{formatTime(durationMs)}</Text>
            </View>
          </View>

          {/* Primary Transport */}
          <View style={styles.transportRow}>
            <TouchableOpacity onPress={toggleShuffle} style={styles.sideCtrlBtn}>
              <Shuffle
                color={isShuffle ? COLORS.primary : COLORS.textSecondary}
                size={21}
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={playPrevious} style={styles.skipBtn}>
              <SkipBack color={COLORS.text} size={28} fill={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={styles.playMainBtn}>
              {isPlaying ? (
                <Pause color={COLORS.black} size={32} fill={COLORS.black} />
              ) : (
                <Play
                  color={COLORS.black}
                  size={32}
                  fill={COLORS.black}
                  style={{ marginLeft: 3 }}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={playNext} style={styles.skipBtn}>
              <SkipForward color={COLORS.text} size={28} fill={COLORS.text} />
            </TouchableOpacity>

            <TouchableOpacity onPress={cycleRepeatMode} style={styles.sideCtrlBtn}>
              {repeatMode === 'one' ? (
                <Repeat1 color={COLORS.primary} size={21} />
              ) : (
                <Repeat
                  color={
                    repeatMode === 'all' ? COLORS.primary : COLORS.textSecondary
                  }
                  size={21}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Quick 10s Seek */}
          <View style={styles.quickSeekRow}>
            <TouchableOpacity
              style={styles.quickSeekBtn}
              onPress={() => skipBackward(10)}
            >
              <RotateCcw color={COLORS.textMuted} size={16} />
              <Text style={styles.quickSeekText}>-10s</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickSeekBtn}
              onPress={() => skipForward(10)}
            >
              <Text style={styles.quickSeekText}>+10s</Text>
              <RotateCw color={COLORS.textMuted} size={16} />
            </TouchableOpacity>
          </View>
        </View>
        </SafeAreaView>

        {/* Sleep Timer Picker Sheet */}
        <Modal
          visible={isSleepModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsSleepModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.sleepOverlay}
            activeOpacity={1}
            onPress={() => setIsSleepModalVisible(false)}
          >
            <View style={styles.sleepSheet} onStartShouldSetResponder={() => true}>
              <Text style={styles.sleepTitle}>Sleep Timer</Text>
              <Text style={styles.sleepSub}>
                {sleepTimer.untilTrackEnd
                  ? 'Pausará ao final desta música'
                  : sleepTimer.endTimeMs
                    ? `Pausará em ${formatTime(sleepRemainingSec * 1000)}`
                    : 'Escolha quando pausar a música automaticamente'}
              </Text>

              {[15, 30, 45, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={styles.sleepOption}
                  onPress={() => {
                    setSleepTimerMinutes(mins);
                    setIsSleepModalVisible(false);
                  }}
                >
                  <Text style={styles.sleepOptionText}>{mins} minutos</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.sleepOption}
                onPress={() => {
                  setSleepTimerEndOfTrack();
                  setIsSleepModalVisible(false);
                }}
              >
                <Text style={styles.sleepOptionText}>Ao fim da música atual</Text>
              </TouchableOpacity>

              {isSleepActive && (
                <TouchableOpacity
                  style={[styles.sleepOption, styles.sleepCancelOption]}
                  onPress={() => {
                    cancelSleepTimer();
                    setIsSleepModalVisible(false);
                  }}
                >
                  <Text style={styles.sleepCancelText}>Desativar Timer</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaProvider>
    </Modal>
  );
};

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
    paddingVertical: SPACING.sm,
  },
  headerLeft: {
    width: 84,
    alignItems: 'flex-start',
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headerAlbum: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    width: 84,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerPillBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerPillBtnActive: {
    backgroundColor: COLORS.primary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  coverWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  coverCard: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.floating,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverQuickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  quickChipActive: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryDim,
  },
  quickChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  quickChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  lyricsWrapper: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  lyricsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 4,
    gap: 6,
  },
  lyricsToolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  lyricsToolBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lyricsToolBtnDisabled: {
    opacity: 0.4,
  },
  lyricsToolBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 74,
    justifyContent: 'center',
  },
  translateBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  translateBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  translateBtnTextActive: {
    color: COLORS.black,
    fontWeight: '800',
  },
  lyricsOffsetPill: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 5,
    minWidth: 46,
    alignItems: 'center',
  },
  lyricsOffsetPillActive: {
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primaryDim,
  },
  lyricsOffsetText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lyricsOffsetTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  lyricsScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  lyricBlock: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 9,
  },
  lyricLine: {
    color: COLORS.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  lyricLineActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  lyricTranslation: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 4,
    opacity: 0.72,
  },
  lyricTranslationActive: {
    color: COLORS.primaryBright,
    opacity: 1,
    fontWeight: '600',
  },
  centerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  fallbackText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  importLrcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    marginTop: 8,
  },
  importLrcText: {
    color: COLORS.black,
    fontWeight: '700',
    fontSize: 13,
  },
  queueContent: {
    padding: SPACING.md,
  },
  queueHeading: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: 6,
  },
  queueItemActive: {
    backgroundColor: COLORS.primaryDim,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  queueArt: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    marginRight: 12,
  },
  queueArtPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  queueTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  queueTitleActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  queueArtist: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  controlsArea: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  trackTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  trackArtist: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  sliderSection: {
    marginTop: 14,
  },
  slider: {
    width: '100%',
    height: 36,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sideCtrlBtn: {
    padding: 10,
  },
  skipBtn: {
    padding: 10,
  },
  playMainBtn: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  quickSeekRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginTop: 12,
  },
  quickSeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  quickSeekText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  titleHeartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleSpacer: {
    width: 34,
  },
  titleHeartBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sleepOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sleepSheet: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  sleepTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sleepSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
  },
  sleepOption: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  sleepOptionText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  sleepCancelOption: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginTop: 4,
  },
  sleepCancelText: {
    color: COLORS.danger,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
