import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  Download,
  Loader2,
  Play,
  Search,
  WifiOff,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { searchOnlineTracks } from '../services/onlineMusicService';
import { formatTime } from '../utils/lrcParser';
import { OnlineTrack } from '../types/music';

interface OnlineSearchModalProps {
  visible: boolean;
  onClose: () => void;
}

export const OnlineSearchModal: React.FC<OnlineSearchModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    isOnline,
    libraryTracks,
    streamOnlineTrack,
    downloadOnlineTrack,
    showToast,
  } = usePlayer();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OnlineTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!visible) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (!isOnline) {
      showToast('Você está offline. Conecte-se para buscar novas músicas.', 'error');
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchOnlineTracks(query);
      setResults(data);
    } catch {
      showToast('Erro ao buscar faixas online.', 'error');
    } finally {
      setIsSearching(false);
    }
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
      const msg = err instanceof Error ? err.message : 'Não foi possível baixar a faixa.';
      showToast(msg, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="modal-full" role="dialog" aria-label="Buscar Online">
      <div className="modal-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Fechar busca online"
          onClick={onClose}
        >
          <ChevronDown size={26} />
        </button>
        <h2 className="modal-header-title">Buscar Online (Audius)</h2>
        <div style={{ width: 38 }} />
      </div>

      <form
        onSubmit={handleSearch}
        style={{ display: 'flex', gap: 8, padding: '12px 16px' }}
      >
        <input
          className="search-input"
          placeholder="Digite música, artista..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button
          type="submit"
          className="pill-primary-btn"
          style={{ borderRadius: 12, padding: '0 16px' }}
          aria-label="Buscar"
        >
          <Search size={18} />
        </button>
      </form>

      <div className="modal-body-scroll" style={{ paddingTop: 4 }}>
        {!isOnline ? (
          <div className="empty-box">
            <WifiOff size={38} color="#fbbf24" />
            <h3 className="empty-title">Modo Offline Ativo</h3>
            <p className="empty-subtitle">
              Conecte-se à internet para buscar novas músicas. Suas músicas já baixadas
              continuam disponíveis na Biblioteca!
            </p>
          </div>
        ) : isSearching ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 20px',
              gap: 12,
              color: 'var(--text-secondary)',
            }}
          >
            <Loader2 size={32} className="spin" color="var(--primary)" />
            <span style={{ fontSize: 14 }}>Buscando faixas...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-box">
            <Search size={36} color="var(--text-muted)" />
            <h3 className="empty-title">Busque qualquer música</h3>
            <p className="empty-subtitle">
              Ouça via streaming ou toque no ícone de download para salvar o MP3 direto
              no seu aparelho e ouvir sem internet.
            </p>
          </div>
        ) : (
          <div className="track-list">
            {results.map((item) => {
              const isDownloading = downloadingId === item.id;
              const isDownloaded = libraryTracks.some(
                (t) => t.id === `dl-${item.id}` && t.sourceType === 'downloaded'
              );
              return (
                <div key={item.id} className="track-card">
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
                      onClick={async () => {
                        await streamOnlineTrack(item);
                        onClose();
                      }}
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
    </div>
  );
};
