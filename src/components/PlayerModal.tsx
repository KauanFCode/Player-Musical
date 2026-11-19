import React, { useEffect, useRef, useState } from 'react';
import {
  AlignLeft,
  ChevronDown,
  Image as ImageIcon,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Pencil,
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
import { LrcLine } from '../types/music';
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
    getTrackArtworkUrl,
    resolveLyricsForTrack,
    updateTrackCover,
    updateTrackLyrics,
    updateTrackInfo,
    togglePlayPause,
    playNext,
    playPrevious,
    seekTo,
    skipForward,
    skipBackward,
    toggleShuffle,
    cycleRepeatMode,
    jumpToQueueIndex,
  } = usePlayer();

  const [centerTab, setCenterTab] = useState<CenterTab>('cover');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const [parsedLyrics, setParsedLyrics] = useState<LrcLine[]>([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [activeLyricIdx, setActiveLyricIdx] = useState(-1);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const lrcInputRef = useRef<HTMLInputElement>(null);
  const lyricLineRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  // Load lyrics whenever track or lyricsRevision changes
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!currentTrack) {
        setParsedLyrics([]);
        setActiveLyricIdx(-1);
        return;
      }
      setIsLoadingLyrics(true);
      setActiveLyricIdx(-1);
      try {
        const raw = await resolveLyricsForTrack(currentTrack);
        if (cancelled) return;
        setParsedLyrics(raw ? parseLrc(raw) : []);
      } finally {
        if (!cancelled) setIsLoadingLyrics(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, lyricsRevision, resolveLyricsForTrack]);

  // Auto-scroll active lyric line
  useEffect(() => {
    if (parsedLyrics.length === 0 || isSeeking) return;
    const idx = getActiveLyricIndex(parsedLyrics, positionMs, 350);
    if (idx !== activeLyricIdx) {
      setActiveLyricIdx(idx);
      if (centerTab === 'lyrics' && idx >= 0) {
        lyricLineRefs.current[idx]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [positionMs, parsedLyrics, isSeeking, activeLyricIdx, centerTab]);

  if (!isPlayerModalVisible || !currentTrack) return null;

  const artworkUrl = getTrackArtworkUrl(currentTrack);
  const displayPos = isSeeking ? seekValue : positionMs;
  const maxDur = durationMs > 0 ? durationMs : 1;

  const fontSizePx =
    settings.lyricFontSize === 'small'
      ? 15
      : settings.lyricFontSize === 'large'
        ? 21
        : 17.5;

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
      }
    }
    e.target.value = '';
  };

  const openEditDialog = () => {
    setEditName(currentTrack.name);
    setEditArtist(currentTrack.artist);
    setEditAlbum(currentTrack.album || '');
    setIsEditOpen(true);
  };

  const saveEditDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateTrackInfo(currentTrack.id, {
      name: editName,
      artist: editArtist,
      album: editAlbum,
    });
    setIsEditOpen(false);
  };

  return (
    <div className="modal-full" role="dialog" aria-label="Tocando Agora">
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
            }}
          >
            TOCANDO AGORA
          </div>
          {currentTrack.album && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentTrack.album}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
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
                  Alterar Capa
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={() => lrcInputRef.current?.click()}
                >
                  <Upload size={14} />
                  Importar .LRC
                </button>
                <button
                  type="button"
                  className="chip-btn"
                  onClick={openEditDialog}
                >
                  <Pencil size={14} />
                  Editar Info
                </button>
              </div>
            </>
          )}

          {centerTab === 'lyrics' && (
            <div className="lyrics-container">
              {isLoadingLyrics ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <Loader2 size={32} className="spin" color="var(--primary)" />
                  <span style={{ fontSize: 14 }}>Buscando letra...</span>
                </div>
              ) : parsedLyrics.length === 0 ? (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    color: 'var(--text-secondary)',
                  }}
                >
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
                parsedLyrics.map((line, idx) => {
                  const isActive = idx === activeLyricIdx;
                  return (
                    <button
                      key={`${idx}-${line.timeMs}`}
                      type="button"
                      ref={(el) => {
                        lyricLineRefs.current[idx] = el;
                      }}
                      className={`lyric-line ${isActive ? 'active' : ''}`}
                      style={{
                        fontSize: isActive ? fontSizePx + 3 : fontSizePx,
                        cursor: line.timeMs >= 0 ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (line.timeMs >= 0) seekTo(line.timeMs);
                      }}
                    >
                      {line.text}
                    </button>
                  );
                })
              )}
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
        <div style={{ paddingTop: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 21, fontWeight: 800 }}>
              <MarqueeText text={currentTrack.name} />
            </div>
            <div
              style={{
                fontSize: 13.5,
                color: 'var(--text-secondary)',
                marginTop: 3,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentTrack.artist}
            </div>
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
              <RotateCcw size={15} />
              -10s
            </button>
            <button
              type="button"
              className="quick-seek-btn"
              onClick={() => skipForward(10)}
            >
              +10s
              <RotateCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Track Info Mini-Dialog */}
      {isEditOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditOpen(false)}>
          <form
            className="dialog-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveEditDialog}
          >
            <h3 className="dialog-title">Editar Informações</h3>

            <label className="setting-desc" style={{ display: 'block', marginBottom: 4 }}>
              Título
            </label>
            <input
              className="search-input"
              style={{ marginBottom: 10 }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />

            <label className="setting-desc" style={{ display: 'block', marginBottom: 4 }}>
              Artista
            </label>
            <input
              className="search-input"
              style={{ marginBottom: 10 }}
              value={editArtist}
              onChange={(e) => setEditArtist(e.target.value)}
            />

            <label className="setting-desc" style={{ display: 'block', marginBottom: 4 }}>
              Álbum
            </label>
            <input
              className="search-input"
              value={editAlbum}
              onChange={(e) => setEditAlbum(e.target.value)}
            />

            <div className="dialog-actions">
              <button
                type="button"
                className="pill-secondary-btn"
                onClick={() => setIsEditOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="pill-primary-btn">
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
