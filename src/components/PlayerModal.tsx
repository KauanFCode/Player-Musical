import React, { useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  ChevronDown,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  Languages,
  ListMusic,
  Loader2,
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
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime, getActiveLyricIndex, parseLrc } from '../utils/lrcParser';
import { translateLyricsLines } from '../utils/assetCache';
import { getCachedLyricsTranslation } from '../utils/storage';
import { LrcLine, LyricFontSize } from '../types/music';
import { MarqueeText } from './MarqueeText';

type CenterTab = 'cover' | 'lyrics' | 'queue';

export const PlayerModal: React.FC = () => {
  const {
    isPlayerModalVisible,
    setPlayerModalVisible,
    currentTrack,
    isPlaying,
    isBuffering,
    positionMs,
    durationMs,
    queue,
    currentIndex,
    isShuffle,
    repeatMode,
    settings,
    lyricsRevision,
    sleepTimer,
    getTrackArtworkUrl,
    resolveLyricsForTrack,
    updateTrackCover,
    updateTrackLyrics,
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

  const [centerTab, setCenterTab] = useState<CenterTab>('cover');
  const [isLyricsFocused, setIsLyricsFocused] = useState(false);
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

  const coverInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const lyricLineRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Load lyrics & cached translation whenever track or lyricsRevision changes
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
      setActiveLyricIdx(-1);
      setTranslatedLines(null);
      setShowTranslation(false);
      setIsTranslating(false);
      try {
        const raw = await resolveLyricsForTrack(currentTrack);
        if (cancelled) return;
        const lines = raw ? parseLrc(raw) : [];
        setParsedLyrics(lines);
        if (lines.length > 0) {
          const cached = getCachedLyricsTranslation(currentTrack.id);
          if (cached && cached.length === lines.length) {
            setTranslatedLines(cached);
          }
        }
      } finally {
        if (!cancelled) setIsLoadingLyrics(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, lyricsRevision, resolveLyricsForTrack]);

  // Countdown for Sleep Timer
  useEffect(() => {
    if (!isPlayerModalVisible || !sleepTimer.endTimeMs) {
      setSleepRemainingSec(0);
      return;
    }
    const tick = () => {
      setSleepRemainingSec(
        Math.max(0, Math.ceil((sleepTimer.endTimeMs! - Date.now()) / 1000))
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [isPlayerModalVisible, sleepTimer.endTimeMs]);

  const currentLyricOffset = currentTrack ? getLyricOffset(currentTrack.id) : 0;

  // Auto-scroll active lyric line centered
  useEffect(() => {
    if (parsedLyrics.length === 0 || isSeeking) return;
    const idx = getActiveLyricIndex(parsedLyrics, positionMs + currentLyricOffset, 350);
    if (idx !== activeLyricIdx) {
      setActiveLyricIdx(idx);
      if (centerTab === 'lyrics' && idx >= 0) {
        lyricLineRefs.current[idx]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [positionMs, currentLyricOffset, parsedLyrics, isSeeking, activeLyricIdx, centerTab]);

  // Reset focus mode when leaving lyrics or closing modal
  useEffect(() => {
    if (centerTab !== 'lyrics' || !isPlayerModalVisible) {
      setIsLyricsFocused(false);
    }
  }, [centerTab, isPlayerModalVisible]);

  // Center active line when entering Lyrics view or toggling translation
  useEffect(() => {
    if (centerTab !== 'lyrics' || activeLyricIdx < 0) return;
    const t = window.setTimeout(() => {
      lyricLineRefs.current[activeLyricIdx]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [centerTab, showTranslation, activeLyricIdx]);

  if (!isPlayerModalVisible || !currentTrack) return null;

  const artworkUrl = getTrackArtworkUrl(currentTrack);
  const displayPos = isSeeking ? seekValue : positionMs;
  const maxDur = durationMs > 0 ? durationMs : 1;

  const fontScaleOrder: LyricFontSize[] = ['small', 'medium', 'large'];
  const currentFontIdx = Math.max(0, fontScaleOrder.indexOf(settings.lyricFontSize));
  const stepLyricFont = (dir: -1 | 1) => {
    const nextIdx = Math.max(0, Math.min(fontScaleOrder.length - 1, currentFontIdx + dir));
    void updateSettings({ lyricFontSize: fontScaleOrder[nextIdx] });
  };

  const fontSizePx =
    settings.lyricFontSize === 'small'
      ? 16
      : settings.lyricFontSize === 'large'
        ? 23
        : 19;

  const isSleepActive = Boolean(sleepTimer.endTimeMs) || sleepTimer.untilTrackEnd;
  const sleepChipLabel = sleepTimer.untilTrackEnd
    ? 'Fim faixa'
    : sleepTimer.endTimeMs
      ? formatTime(sleepRemainingSec * 1000)
      : 'Timer';

  const offsetLabel =
    currentLyricOffset === 0
      ? '0.0s'
      : `${currentLyricOffset > 0 ? '+' : ''}${(currentLyricOffset / 1000).toFixed(1)}s`;

  const currentFav = isFavorite(currentTrack.id);

  const handleCoverPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentTrack) {
      await updateTrackCover(currentTrack.id, file);
    }
    e.target.value = '';
  };

  const handleLrcPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentTrack) {
      const text = await file.text();
      if (text.trim()) {
        await updateTrackLyrics(currentTrack.id, text);
        setParsedLyrics(parseLrc(text));
        setTranslatedLines(null);
        setShowTranslation(false);
      }
    }
    e.target.value = '';
  };

  const handleToggleTranslation = async () => {
    if (parsedLyrics.length === 0) return;
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
      const translated = await translateLyricsLines(
        currentTrack.id,
        parsedLyrics.map((l) => l.text)
      );
      setTranslatedLines(translated);
      setShowTranslation(true);
    } catch {
      // Silently ignore translation failure offline
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="modal-full player-modal" role="dialog" aria-label="Tocando Agora">
      {artworkUrl && (
        <div
          className="player-ambient-bg"
          style={{ backgroundImage: `url(${artworkUrl})` }}
        />
      )}

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleCoverPick}
      />
      <input
        ref={lrcInputRef}
        type="file"
        accept=".lrc,.txt,text/plain"
        style={{ display: 'none' }}
        onChange={handleLrcPick}
      />

      {/* Header */}
      <div className="modal-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Fechar player"
          onClick={() => setPlayerModalVisible(false)}
        >
          <ChevronDown size={26} />
        </button>

        <div style={{ textAlign: 'center', minWidth: 0, flex: 1, padding: '0 8px' }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isLyricsFocused && centerTab === 'lyrics'
              ? currentTrack.name
              : 'TOCANDO AGORA'}
          </div>
          {isLyricsFocused && centerTab === 'lyrics' ? (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentTrack.artist}
            </div>
          ) : (
            (currentTrack.album || currentTrack.folderName) && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {currentTrack.album || currentTrack.folderName}
              </div>
            )
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {centerTab === 'lyrics' && (
            <button
              type="button"
              className={`icon-btn ${isLyricsFocused ? 'active' : ''}`}
              aria-label={
                isLyricsFocused
                  ? 'Mostrar controles do player'
                  : 'Esconder controles do player'
              }
              title={
                isLyricsFocused
                  ? 'Mostrar controles do player'
                  : 'Esconder controles do player'
              }
              onClick={() => setIsLyricsFocused((prev) => !prev)}
            >
              {isLyricsFocused ? <Eye size={19} /> : <EyeOff size={19} />}
            </button>
          )}
          <button
            type="button"
            className={`icon-btn ${centerTab === 'queue' ? 'active' : ''}`}
            aria-label="Fila de reprodução"
            onClick={() =>
              setCenterTab((prev) => (prev === 'queue' ? 'cover' : 'queue'))
            }
          >
            <ListMusic size={19} />
          </button>
          <button
            type="button"
            className={`icon-btn ${centerTab === 'lyrics' ? 'active' : ''}`}
            aria-label="Letras sincronizadas"
            onClick={() =>
              setCenterTab((prev) => (prev === 'lyrics' ? 'cover' : 'lyrics'))
            }
          >
            <AlignLeft size={19} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="player-content">
        <div className="player-center">
          {centerTab === 'cover' && (
            <>
              <div
                className={`cover-stage ${
                  isPlaying && settings.pulseCoverAnimation ? 'pulsing' : ''
                }`}
              >
                {artworkUrl ? (
                  <img src={artworkUrl} alt={currentTrack.name} />
                ) : (
                  <Music size={72} color="var(--text-muted)" />
                )}
              </div>

              <div className="quick-chips-row">
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => coverInputRef.current?.click()}
                >
                  <ImageIcon size={14} />
                  Capa
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => lrcInputRef.current?.click()}
                >
                  <Upload size={14} />
                  .LRC
                </button>
                <button
                  type="button"
                  className={`chip-btn ${isSleepActive ? 'chip-btn-active' : ''}`}
                  onClick={() => setIsSleepModalVisible(true)}
                >
                  <Moon size={14} />
                  {sleepChipLabel}
                </button>
              </div>
            </>
          )}

          {centerTab === 'lyrics' && (
            <div className="lyrics-view-wrap">
              {!isLyricsFocused && (
              <div className="lyrics-toolbar">
                <div className="lyrics-tool-group">
                  <button
                    type="button"
                    className="lyrics-tool-btn"
                    disabled={currentFontIdx === 0}
                    onClick={() => stepLyricFont(-1)}
                    aria-label="Diminuir fonte"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    className="lyrics-tool-btn"
                    disabled={currentFontIdx === fontScaleOrder.length - 1}
                    onClick={() => stepLyricFont(1)}
                    aria-label="Aumentar fonte"
                  >
                    A+
                  </button>
                </div>

                <div className="lyrics-tool-group">
                  <button
                    type="button"
                    className="lyrics-tool-btn"
                    onClick={() => adjustLyricOffset(currentTrack.id, -500)}
                    aria-label="Atrasar letra em 0.5s"
                  >
                    -0.5s
                  </button>
                  <button
                    type="button"
                    className={`lyrics-offset-pill ${currentLyricOffset !== 0 ? 'active' : ''}`}
                    onClick={() => resetLyricOffset(currentTrack.id)}
                    aria-label="Zerar sincronia"
                  >
                    {offsetLabel}
                  </button>
                  <button
                    type="button"
                    className="lyrics-tool-btn"
                    onClick={() => adjustLyricOffset(currentTrack.id, 500)}
                    aria-label="Adiantar letra em 0.5s"
                  >
                    +0.5s
                  </button>
                </div>

                <button
                  type="button"
                  className={`translate-btn ${showTranslation ? 'active' : ''}`}
                  disabled={isTranslating || parsedLyrics.length === 0}
                  onClick={handleToggleTranslation}
                >
                  {isTranslating ? (
                    <Loader2 size={13} className="spin" />
                  ) : (
                    <>
                      <Languages size={13} />
                      <span>{showTranslation ? 'PT-BR' : 'Traduzir'}</span>
                    </>
                  )}
                </button>
              </div>
              )}

              <div className="lyrics-container lyrics-centered-container">
                {isLoadingLyrics ? (
                  <div className="lyrics-empty-center">
                    <Loader2 size={32} className="spin" color="var(--primary)" />
                    <span style={{ fontSize: 14 }}>Buscando letra...</span>
                  </div>
                ) : parsedLyrics.length === 0 ? (
                  <div className="lyrics-empty-center">
                    <AlignLeft size={38} color="var(--text-muted)" />
                    <span style={{ fontSize: 14 }}>Nenhuma letra encontrada.</span>
                    <button
                      type="button"
                      className="pill-primary-btn"
                      onClick={() => lrcInputRef.current?.click()}
                    >
                      <Upload size={15} />
                      Importar arquivo .LRC
                    </button>
                  </div>
                ) : (
                  <div className="lyrics-list-centered">
                    {parsedLyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIdx;
                      const translated =
                        showTranslation && translatedLines?.[idx]
                          ? translatedLines[idx].trim()
                          : '';
                      const shouldShowTranslation =
                        Boolean(translated) &&
                        translated.toLowerCase() !== line.text.trim().toLowerCase();

                      return (
                        <button
                          key={`${idx}-${line.timeMs}`}
                          type="button"
                          ref={(el) => {
                            lyricLineRefs.current[idx] = el;
                          }}
                          className={`lyric-line ${isActive ? 'active' : ''}`}
                          style={{
                            fontSize: isActive ? fontSizePx + 4 : fontSizePx,
                            cursor: line.timeMs >= 0 ? 'pointer' : 'default',
                          }}
                          onClick={() => {
                            if (line.timeMs >= 0) {
                              seekTo(Math.max(0, line.timeMs - currentLyricOffset));
                            }
                          }}
                        >
                          <span>{line.text}</span>
                          {shouldShowTranslation && (
                            <span
                              className={`lyric-translation ${isActive ? 'active' : ''}`}
                              style={{ fontSize: Math.max(12.5, fontSizePx - 3.5) }}
                            >
                              {translated}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {centerTab === 'queue' && (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                padding: '12px 0',
              }}
            >
              <div className="section-label" style={{ marginTop: 0 }}>
                Fila de Reprodução ({queue.length})
              </div>
              <div className="track-list">
                {queue.map((item, idx) => {
                  const active = idx === currentIndex;
                  const art = getTrackArtworkUrl(item);
                  return (
                    <button
                      key={`${item.id}-${idx}`}
                      type="button"
                      className={`track-card ${active ? 'active' : ''}`}
                      onClick={() => jumpToQueueIndex(idx)}
                    >
                      {art ? (
                        <img src={art} alt={item.name} className="track-art" />
                      ) : (
                        <div className="track-art-placeholder">
                          <Music size={18} />
                        </div>
                      )}
                      <div className="track-info">
                        <div className="track-title">{item.name}</div>
                        <div className="track-sub">{item.artist}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Controls */}
        {centerTab === 'lyrics' && isLyricsFocused ? (
          <div className="lyrics-focus-footer">
            <button
              type="button"
              className="lyrics-restore-btn"
              onClick={() => setIsLyricsFocused(false)}
            >
              <Eye size={15} />
              <span>Mostrar controles</span>
            </button>
          </div>
        ) : (
        <div className="player-controls-footer" style={{ paddingTop: 10 }}>
          <div className="player-title-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 800 }}>
                <MarqueeText text={currentTrack.name} />
              </div>
              <div className="player-artist-sub">{currentTrack.artist}</div>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => toggleFavorite(currentTrack.id)}
              aria-label="Favoritar música"
            >
              <Heart
                size={21}
                color={currentFav ? 'var(--primary)' : 'var(--text-secondary)'}
                fill={currentFav ? 'var(--primary)' : 'none'}
              />
            </button>
          </div>

          <input
            type="range"
            className="seek-slider"
            min={0}
            max={maxDur}
            value={Math.min(displayPos, maxDur)}
            aria-label="Posição da música"
            onMouseDown={() => {
              setIsSeeking(true);
              setSeekValue(positionMs);
            }}
            onTouchStart={() => {
              setIsSeeking(true);
              setSeekValue(positionMs);
            }}
            onChange={(e) => {
              const val = Number(e.target.value);
              setIsSeeking(true);
              setSeekValue(val);
            }}
            onMouseUp={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              seekTo(val);
              setIsSeeking(false);
            }}
            onTouchEnd={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              seekTo(val);
              setIsSeeking(false);
            }}
          />

          <div className="time-row">
            <span>{formatTime(displayPos)}</span>
            <span>{formatTime(durationMs)}</span>
          </div>

          <div className="transport-row">
            <button
              type="button"
              className="icon-btn"
              style={{ color: isShuffle ? 'var(--primary)' : 'var(--text-secondary)' }}
              aria-label="Modo aleatório"
              onClick={toggleShuffle}
            >
              <Shuffle size={20} />
            </button>

            <button
              type="button"
              className="icon-btn"
              style={{ color: 'var(--text)' }}
              aria-label="Música anterior"
              onClick={playPrevious}
            >
              <SkipBack size={26} fill="currentColor" />
            </button>

            <button
              type="button"
              className="play-main-btn"
              aria-label={isPlaying ? 'Pausar' : 'Tocar'}
              onClick={togglePlayPause}
            >
              {isBuffering ? (
                <Loader2 size={28} className="spin" />
              ) : isPlaying ? (
                <Pause size={28} fill="currentColor" />
              ) : (
                <Play size={28} fill="currentColor" style={{ marginLeft: 3 }} />
              )}
            </button>

            <button
              type="button"
              className="icon-btn"
              style={{ color: 'var(--text)' }}
              aria-label="Próxima música"
              onClick={playNext}
            >
              <SkipForward size={26} fill="currentColor" />
            </button>

            <button
              type="button"
              className="icon-btn"
              style={{
                color:
                  repeatMode !== 'off' ? 'var(--primary)' : 'var(--text-secondary)',
              }}
              aria-label="Modo de repetição"
              onClick={cycleRepeatMode}
            >
              {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
            </button>
          </div>

          <div className="quick-seek-row">
            <button
              type="button"
              className="quick-seek-btn"
              onClick={() => skipBackward(10)}
            >
              <RotateCcw size={14} />
              -10s
            </button>
            <button
              type="button"
              className="quick-seek-btn"
              onClick={() => skipForward(10)}
            >
              +10s
              <RotateCw size={14} />
            </button>
          </div>
        </div>
        )}
      </div>

      {/* Sleep Timer Sheet */}
      {isSleepModalVisible && (
        <div className="modal-backdrop" onClick={() => setIsSleepModalVisible(false)}>
          <div className="dialog-card action-sheet-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">Temporizador (Sleep Timer)</h3>
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                className="action-sheet-row"
                onClick={() => {
                  setSleepTimerMinutes(mins);
                  setIsSleepModalVisible(false);
                }}
              >
                <Moon size={16} color="var(--primary)" />
                <span>Parar em {mins} minutos</span>
              </button>
            ))}
            <button
              type="button"
              className="action-sheet-row"
              onClick={() => {
                setSleepTimerEndOfTrack();
                setIsSleepModalVisible(false);
              }}
            >
              <Moon size={16} color="var(--text-secondary)" />
              <span>Ao fim da música atual</span>
            </button>
            {isSleepActive && (
              <button
                type="button"
                className="action-sheet-row danger"
                onClick={() => {
                  cancelSleepTimer();
                  setIsSleepModalVisible(false);
                }}
              >
                <span>Desativar temporizador</span>
              </button>
            )}
            <button
              type="button"
              className="pill-secondary-btn"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setIsSleepModalVisible(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
