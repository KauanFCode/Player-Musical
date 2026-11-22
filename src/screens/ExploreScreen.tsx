import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Download,
  Flame,
  Loader2,
  Music,
  Play,
  RefreshCw,
  Search,
  WifiOff,
  X,
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
    searchOnlineTracks,
    streamOnlineTrack,
    downloadOnlineTrack,
    showToast,
  } = usePlayer();

  const [selectedGenre, setSelectedGenre] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [tracks, setTracks] = useState<OnlineTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [brokenArtIds, setBrokenArtIds] = useState<Record<string, boolean>>({});

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

  const runSearch = useCallback(
    async (query: string) => {
      const clean = query.trim();
      if (!clean) {
        setActiveSearchQuery('');
        await loadTrending(selectedGenre);
        return;
      }
      if (!navigator.onLine) {
        showToast('Você está offline.', 'error');
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
    [loadTrending, searchOnlineTracks, selectedGenre, showToast]
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
      void loadTrending(value);
    } else {
      setSelectedGenre(value);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setActiveSearchQuery('');
    void loadTrending(selectedGenre);
  };

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
        <div>
          <div className="screen-eyebrow">DESCOBRIR ONLINE</div>
          <h1 className="screen-title">Explorar</h1>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Atualizar lista"
          onClick={() =>
            activeSearchQuery ? runSearch(activeSearchQuery) : loadTrending(selectedGenre)
          }
        >
          <RefreshCw size={19} />
        </button>
      </header>

      <form
        className="explore-search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(searchInput);
        }}
      >
        <Search size={17} color="var(--text-muted)" />
        <input
          className="search-inline-input"
          placeholder="Buscar música ou artista online..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button type="button" onClick={handleClearSearch} aria-label="Limpar busca">
            <X size={15} color="var(--text-muted)" />
          </button>
        )}
        <button type="submit" className="explore-search-submit">
          Buscar
        </button>
      </form>

      <div className="genre-scroll">
        {GENRES.map((g) => {
          const active = !activeSearchQuery && selectedGenre === g.value;
          return (
            <button
              key={g.label}
              type="button"
              className={`genre-chip ${active ? 'active' : ''}`}
              onClick={() => handleSelectGenre(g.value)}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {activeSearchQuery ? (
        <div className="explore-status-row">
          <span className="track-sub" style={{ fontSize: 12.5 }}>
            Resultados para &quot;{activeSearchQuery}&quot;
          </span>
          <button
            type="button"
            style={{ color: 'var(--primary)', fontSize: 12.5, fontWeight: 700 }}
            onClick={handleClearSearch}
          >
            Limpar
          </button>
        </div>
      ) : (
        <div className="explore-status-row">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            <Flame size={14} color="var(--primary)" />
            {selectedGenre ? `Em Alta • ${selectedGenre}` : 'Em Alta Agora'}
          </span>
          <span className="track-count-meta">{tracks.length} faixas</span>
        </div>
      )}

      {!isOnline ? (
        <div className="empty-box">
          <WifiOff size={38} color="#fbbf24" />
          <h2 className="empty-title">Você está offline</h2>
          <p className="empty-subtitle">
            O Explorar carrega e pesquisa faixas da internet. Suas músicas importadas e
            baixadas continuam funcionando normalmente na Biblioteca!
          </p>
        </div>
      ) : isLoading ? (
        <div className="explore-loading-box">
          <Loader2 size={32} className="spin" color="var(--primary)" />
          <span>
            {activeSearchQuery ? 'Buscando músicas online...' : 'Carregando músicas em alta...'}
          </span>
        </div>
      ) : tracks.length === 0 ? (
        <div className="empty-box">
          <Music size={34} color="var(--text-muted)" />
          <h2 className="empty-title">Nenhuma faixa encontrada</h2>
          <p className="empty-subtitle">
            {activeSearchQuery
              ? 'Tente outro termo de busca.'
              : 'Tente atualizar a lista novamente.'}
          </p>
        </div>
      ) : (
        <div className="track-list">
          {tracks.map((item, idx) => {
            const isDownloading = downloadingId === item.id;
            const isDownloaded = libraryTracks.some(
              (t) =>
                (t.id === `dl-${item.id}` && t.sourceType === 'downloaded') ||
                (t.sourceType === 'downloaded' &&
                  t.name.toLowerCase() === item.title.toLowerCase())
            );
            return (
              <div
                key={item.id}
                className="track-card"
                onClick={() => void streamOnlineTrack(item)}
                role="button"
                tabIndex={0}
              >
                {!activeSearchQuery && <span className="rank-num">{idx + 1}</span>}
                {item.artworkUrl && !brokenArtIds[item.id] ? (
                  <img
                    src={item.artworkUrl}
                    alt={item.title}
                    className="track-art"
                    onError={() =>
                      setBrokenArtIds((prev) => ({ ...prev, [item.id]: true }))
                    }
                  />
                ) : (
                  <div className="track-art-placeholder">
                    <Music size={18} />
                  </div>
                )}
                <div className="track-info">
                  <div className="track-title">{item.title}</div>
                  <div className="track-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.artist}
                      {item.durationMs ? ` • ${formatTime(item.durationMs)}` : ''}
                    </span>
                    <span className="online-badge">ONLINE</span>
                  </div>
                </div>

                <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="small-icon-btn"
                    style={{ color: 'var(--primary)' }}
                    aria-label={`Tocar ${item.title}`}
                    onClick={() => void streamOnlineTrack(item)}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>

                  <button
                    type="button"
                    className="small-icon-btn"
                    aria-label={`Baixar ${item.title} offline`}
                    disabled={isDownloading}
                    onClick={() => void handleDownload(item)}
                  >
                    {isDownloading ? (
                      <Loader2 size={16} className="spin" color="var(--primary)" />
                    ) : isDownloaded ? (
                      <Check size={17} color="var(--primary)" />
                    ) : (
                      <Download size={16} />
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
