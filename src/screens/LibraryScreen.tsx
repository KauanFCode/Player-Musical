import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  DownloadCloud,
  FolderOpen,
  HelpCircle,
  ListMusic,
  ListPlus,
  Loader2,
  Music,
  Play,
  Plus,
  Search,
  Settings,
  Shuffle,
  Sparkles,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { SettingsModal } from '../components/SettingsModal';
import { HelpModal } from '../components/HelpModal';
import { OnlineSearchModal } from '../components/OnlineSearchModal';
import {
  AddToPlaylistModal,
  CreatePlaylistModal,
  PlaylistDetailModal,
} from '../components/PlaylistModals';
import { formatTime } from '../utils/lrcParser';
import { AudioTrack, Playlist } from '../types/music';

export const LibraryScreen: React.FC = () => {
  const {
    isOnline,
    canInstall,
    promptInstall,
    libraryTracks,
    userPlaylists,
    currentTrack,
    isSyncingAssets,
    getTrackArtworkUrl,
    playTrack,
    playQueue,
    importLocalFiles,
    removeTrack,
    syncAllLibraryAssets,
    deletePlaylist,
    setPlayerModalVisible,
    showToast,
  } = usePlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists'>('tracks');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isOnlineSearchVisible, setIsOnlineSearchVisible] = useState(false);
  const [isCreatePlaylistVisible, setIsCreatePlaylistVisible] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] = useState<AudioTrack | null>(null);
  const [isAddToPlaylistVisible, setIsAddToPlaylistVisible] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const [pendingDeleteTrack, setPendingDeleteTrack] = useState<AudioTrack | null>(null);
  const [pendingDeletePlaylist, setPendingDeletePlaylist] = useState<Playlist | null>(null);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return libraryTracks;
    return libraryTracks.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [libraryTracks, searchQuery]);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await importLocalFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await importLocalFiles(e.dataTransfer.files);
    }
  };

  const handleShufflePlayAll = async () => {
    if (filteredTracks.length === 0) return;
    const randomIdx = Math.floor(Math.random() * filteredTracks.length);
    await playQueue(filteredTracks, randomIdx);
    setPlayerModalVisible(true);
  };

  const handlePlayPlaylist = async (pl: Playlist) => {
    const tracks = libraryTracks.filter((t) => pl.trackIds.includes(t.id));
    if (tracks.length === 0) {
      showToast('Adicione músicas a esta playlist primeiro.', 'info');
      return;
    }
    await playQueue(tracks, 0);
    setPlayerModalVisible(true);
  };

  return (
    <div
      className={`screen-scroll ${isDragging ? 'dropzone-active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,image/*,.mp3,.m4a,.wav,.aac,.flac,.ogg,.opus,.lrc,.txt"
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />

      {/* Header */}
      <header className="screen-header">
        <div className="screen-title-wrap">
          <h1 className="screen-title">Sua Biblioteca</h1>
          {!isOnline && (
            <span className="status-badge offline">
              <WifiOff size={12} />
              Offline
            </span>
          )}
        </div>

        <div className="header-actions">
          {canInstall && (
            <button
              type="button"
              className="install-pill-btn"
              onClick={promptInstall}
            >
              <Download size={13} />
              Instalar
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label="Configurações"
            onClick={() => setIsSettingsVisible(true)}
          >
            <Settings size={20} />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Guia e Instalação"
            onClick={() => setIsHelpVisible(true)}
          >
            <HelpCircle size={20} />
          </button>
          <button
            type="button"
            className={`icon-btn ${isSearching ? 'active' : ''}`}
            aria-label="Buscar na biblioteca"
            onClick={() => {
              setIsSearching((prev) => {
                if (prev) setSearchQuery('');
                return !prev;
              });
            }}
          >
            <Search size={20} />
          </button>
        </div>
      </header>

      {isSearching && (
        <div className="search-box">
          <input
            className="search-input"
            placeholder="Filtrar por título, artista ou álbum..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Action Grid */}
      <div className="action-grid">
        <button
          type="button"
          className="action-card-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <FolderOpen size={16} />
          <span>Arquivos</span>
        </button>

        <button
          type="button"
          className="action-card-btn"
          onClick={syncAllLibraryAssets}
          disabled={isSyncingAssets}
        >
          {isSyncingAssets ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <Sparkles size={16} />
          )}
          <span>{isSyncingAssets ? 'Buscando...' : 'Puxar Capas'}</span>
        </button>

        <button
          type="button"
          className="action-card-btn"
          onClick={() => setIsOnlineSearchVisible(true)}
        >
          <DownloadCloud size={16} />
          <span>Buscar Online</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs-row">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'tracks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tracks')}
        >
          <Music size={15} />
          <span>Músicas ({libraryTracks.length})</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'playlists' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          <ListMusic size={15} />
          <span>Playlists ({userPlaylists.length})</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'tracks' ? (
        <>
          {filteredTracks.length > 1 && (
            <div className="quick-play-row">
              <button
                type="button"
                className="pill-primary-btn"
                onClick={async () => {
                  await playQueue(filteredTracks, 0);
                  setPlayerModalVisible(true);
                }}
              >
                <Play size={15} fill="currentColor" />
                Tocar Tudo
              </button>
              <button
                type="button"
                className="pill-secondary-btn"
                onClick={handleShufflePlayAll}
              >
                <Shuffle size={15} />
                Aleatório
              </button>
            </div>
          )}

          {filteredTracks.length === 0 ? (
            <div className="empty-box">
              <Music size={40} color="var(--text-muted)" />
              <h2 className="empty-title">
                {searchQuery ? 'Nenhum resultado' : 'Sua biblioteca está vazia'}
              </h2>
              <p className="empty-subtitle">
                {searchQuery
                  ? 'Nenhuma música corresponde à sua busca.'
                  : 'Toque em "Arquivos" (ou arraste MP3 aqui) para importar músicas offline, ou use "Buscar Online" para baixar.'}
              </p>
            </div>
          ) : (
            <div className="track-list">
              {filteredTracks.map((item) => {
                const isCurrent = currentTrack?.id === item.id;
                const art = getTrackArtworkUrl(item);
                const badgeText =
                  item.sourceType === 'local'
                    ? 'Offline'
                    : item.sourceType === 'downloaded'
                      ? 'Baixada (Offline)'
                      : 'Online';

                return (
                  <div
                    key={item.id}
                    className={`track-card ${isCurrent ? 'active' : ''}`}
                  >
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flex: 1,
                        minWidth: 0,
                        textAlign: 'left',
                      }}
                      onClick={() => playTrack(item, filteredTracks)}
                    >
                      {art ? (
                        <img src={art} alt={item.name} className="track-art" />
                      ) : (
                        <div className="track-art-placeholder">
                          <Music size={20} />
                        </div>
                      )}
                      <div className="track-info">
                        <div className="track-title">{item.name}</div>
                        <div className="track-sub">
                          {item.artist} • {badgeText}
                          {item.durationMs ? ` • ${formatTime(item.durationMs)}` : ''}
                        </div>
                      </div>
                    </button>

                    <div className="track-actions">
                      <button
                        type="button"
                        className="small-icon-btn"
                        aria-label={`Adicionar ${item.name} à playlist`}
                        onClick={() => {
                          setTrackForPlaylist(item);
                          setIsAddToPlaylistVisible(true);
                        }}
                      >
                        <ListPlus size={18} />
                      </button>
                      <button
                        type="button"
                        className="small-icon-btn danger"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => setPendingDeleteTrack(item)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="pill-primary-btn"
            style={{ marginBottom: 14 }}
            onClick={() => {
              setTrackForPlaylist(null);
              setIsCreatePlaylistVisible(true);
            }}
          >
            <Plus size={16} />
            Nova Playlist
          </button>

          {userPlaylists.length === 0 ? (
            <div className="empty-box">
              <ListMusic size={40} color="var(--text-muted)" />
              <h2 className="empty-title">Nenhuma playlist</h2>
              <p className="empty-subtitle">
                Crie uma playlist para organizar suas músicas favoritas.
              </p>
            </div>
          ) : (
            <div className="track-list">
              {userPlaylists.map((pl) => (
                <div key={pl.id} className="track-card">
                  <button
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                    }}
                    onClick={() => setSelectedPlaylist(pl)}
                  >
                    <div
                      className="track-art-placeholder"
                      style={{
                        background: 'var(--primary-dim)',
                        color: 'var(--primary)',
                      }}
                    >
                      <ListMusic size={21} />
                    </div>
                    <div className="track-info">
                      <div className="track-title">{pl.name}</div>
                      <div className="track-sub">
                        {pl.trackIds.length}{' '}
                        {pl.trackIds.length === 1 ? 'música' : 'músicas'}
                      </div>
                    </div>
                  </button>

                  <div className="track-actions">
                    <button
                      type="button"
                      className="small-icon-btn"
                      style={{
                        background: 'var(--primary)',
                        color: '#000',
                        marginRight: 4,
                      }}
                      aria-label={`Tocar playlist ${pl.name}`}
                      onClick={() => handlePlayPlaylist(pl)}
                    >
                      <Play size={15} fill="currentColor" />
                    </button>
                    <button
                      type="button"
                      className="small-icon-btn danger"
                      aria-label={`Excluir playlist ${pl.name}`}
                      onClick={() => setPendingDeletePlaylist(pl)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Delete Confirm Dialog */}
      {(pendingDeleteTrack || pendingDeletePlaylist) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setPendingDeleteTrack(null);
            setPendingDeletePlaylist(null);
          }}
        >
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">
              {pendingDeleteTrack ? 'Remover Música' : 'Excluir Playlist'}
            </h3>
            <p className="setting-desc" style={{ fontSize: 14, lineHeight: 1.5 }}>
              Deseja realmente remover{' '}
              <strong style={{ color: 'var(--text)' }}>
                {pendingDeleteTrack?.name || pendingDeletePlaylist?.name}
              </strong>
              ?
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="pill-secondary-btn"
                onClick={() => {
                  setPendingDeleteTrack(null);
                  setPendingDeletePlaylist(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pill-primary-btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={async () => {
                  if (pendingDeleteTrack) {
                    await removeTrack(pendingDeleteTrack.id);
                    setPendingDeleteTrack(null);
                  } else if (pendingDeletePlaylist) {
                    await deletePlaylist(pendingDeletePlaylist.id);
                    setPendingDeletePlaylist(null);
                  }
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />
      <HelpModal visible={isHelpVisible} onClose={() => setIsHelpVisible(false)} />
      <OnlineSearchModal
        visible={isOnlineSearchVisible}
        onClose={() => setIsOnlineSearchVisible(false)}
      />
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
      <PlaylistDetailModal
        playlist={selectedPlaylist}
        onClose={() => setSelectedPlaylist(null)}
      />
    </div>
  );
};
