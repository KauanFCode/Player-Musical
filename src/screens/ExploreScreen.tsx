import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Download,
  Flame,
  Loader2,
  Play,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { formatTime } from '../utils/lrcParser';
import { OnlineTrack } from '../types/music';

const GENRES = [
  { label: 'Em Alta', value: '' },
  { label: 'Electronic', value: 'Electronic' },
  { label: 'Hip-Hop/Rap', value: 'Hip-Hop/Rap' },
  { label: 'Pop', value: 'Pop' },
  { label: 'Rock', value: 'Rock' },
  { label: 'Lo-Fi', value: 'Lo-Fi' },
];

export const ExploreScreen: React.FC = () => {
  const {
    isOnline,
    libraryTracks,
    fetchTrendingTracks,
    streamOnlineTrack,
    downloadOnlineTrack,
    showToast,
  } = usePlayer();

  const [selectedGenre, setSelectedGenre] = useState('');
  const [tracks, setTracks] = useState<OnlineTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadTrending = useCallback(
    async (genre: string) => {
      if (!navigator.onLine) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const data = await fetchTrendingTracks(genre || undefined);
        setTracks(data);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchTrendingTracks]
  );

  useEffect(() => {
    loadTrending(selectedGenre);
  }, [selectedGenre, loadTrending]);

  const handleDownload = async (item: OnlineTrack) => {
    if (!isOnline) {
      showToast('Você está offline.', 'error');
      return;
    }
    setDownloadingId(item.id);
    try {
      await downloadOnlineTrack(item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao baixar música.';
      showToast(msg, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="screen-scroll">
      <header className="screen-header">
        <div className="screen-title-wrap">
          <Flame size={24} color="var(--primary)" />
          <h1 className="screen-title">Explorar</h1>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Atualizar lista"
          onClick={() => loadTrending(selectedGenre)}
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <div className="genre-scroll">
        {GENRES.map((g) => (
          <button
            key={g.label}
            type="button"
            className={`genre-chip ${selectedGenre === g.value ? 'active' : ''}`}
            onClick={() => setSelectedGenre(g.value)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {!isOnline ? (
        <div className="empty-box">
          <WifiOff size={38} color="#fbbf24" />
          <h2 className="empty-title">Você está offline</h2>
          <p className="empty-subtitle">
            O Explorar carrega faixas em alta da internet. Suas músicas importadas e
            baixadas continuam funcionando normalmente na Biblioteca!
          </p>
        </div>
      ) : isLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 20px',
            gap: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <Loader2 size={32} className="spin" color="var(--primary)" />
          <span style={{ fontSize: 14 }}>Carregando músicas em alta...</span>
        </div>
      ) : tracks.length === 0 ? (
        <div className="empty-box">
          <Flame size={38} color="var(--text-muted)" />
          <h2 className="empty-title">Nenhuma faixa encontrada</h2>
          <p className="empty-subtitle">
            Não foi possível carregar o catálogo no momento. Toque em atualizar para tentar
            novamente.
          </p>
        </div>
      ) : (
        <div className="track-list">
          {tracks.map((item, idx) => {
            const isDownloading = downloadingId === item.id;
            const isDownloaded = libraryTracks.some(
              (t) => t.id === `dl-${item.id}` && t.sourceType === 'downloaded'
            );
            return (
              <div key={item.id} className="track-card">
                <span className="rank-num">{idx + 1}</span>
                <img src={item.artworkUrl} alt={item.title} className="track-art" />
                <div className="track-info">
                  <div className="track-title">{item.title}</div>
                  <div className="track-sub">
                    {item.artist}
                    {item.durationMs ? ` • ${formatTime(item.durationMs)}` : ''}
                  </div>
                </div>
                <div className="track-actions">
                  <button
                    type="button"
                    className="small-icon-btn"
                    style={{ color: 'var(--primary)' }}
                    aria-label={`Tocar ${item.title}`}
                    onClick={() => streamOnlineTrack(item)}
                  >
                    <Play size={18} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    className="small-icon-btn"
                    style={{
                      color: isDownloaded ? 'var(--primary)' : 'var(--text)',
                    }}
                    aria-label={`Baixar ${item.title} offline`}
                    disabled={isDownloading}
                    onClick={() => handleDownload(item)}
                  >
                    {isDownloading ? (
                      <Loader2 size={18} className="spin" color="var(--primary)" />
                    ) : isDownloaded ? (
                      <Check size={18} />
                    ) : (
                      <Download size={18} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
