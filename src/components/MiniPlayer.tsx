import React from 'react';
import { Music, Pause, Play, SkipForward } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    positionMs,
    durationMs,
    getTrackArtworkUrl,
    togglePlayPause,
    playNext,
    setPlayerModalVisible,
  } = usePlayer();

  if (!currentTrack) return null;

  const artUrl = getTrackArtworkUrl(currentTrack);
  const pct =
    durationMs > 0 ? Math.min(100, Math.max(0, (positionMs / durationMs) * 100)) : 0;

  return (
    <div className="mini-player">
      <div className="mini-progress-track">
        <div className="mini-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="mini-player-row">
        <button
          type="button"
          className="mini-player-main"
          onClick={() => setPlayerModalVisible(true)}
        >
          {artUrl ? (
            <img src={artUrl} alt={currentTrack.name} className="mini-art" />
          ) : (
            <div className="mini-art-placeholder">
              <Music size={19} />
            </div>
          )}

          <div className="track-info">
            <div className="track-title" style={{ fontSize: 13.5 }}>
              {currentTrack.name}
            </div>
            <div className="track-sub">{currentTrack.artist}</div>
          </div>
        </button>

        <button
          type="button"
          className="small-icon-btn"
          style={{ color: 'var(--primary)' }}
          aria-label={isPlaying ? 'Pausar' : 'Tocar'}
          onClick={togglePlayPause}
        >
          {isPlaying ? (
            <Pause size={21} fill="currentColor" />
          ) : (
            <Play size={21} fill="currentColor" />
          )}
        </button>

        <button
          type="button"
          className="small-icon-btn"
          aria-label="Próxima música"
          onClick={playNext}
        >
          <SkipForward size={19} />
        </button>
      </div>
    </div>
  );
};
