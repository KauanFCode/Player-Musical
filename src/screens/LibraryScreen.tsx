import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  FolderPlus,
  Heart,
  HelpCircle,
  ListMusic,
  ListPlus,
  MoreVertical,
  Music,
  Play,
  PlayCircle,
  Search,
  Settings,
  Shuffle,
  Trash2,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { SettingsModal } from '../components/SettingsModal';
import { HelpModal } from '../components/HelpModal';
import {
  AddToPlaylistModal,
  CreatePlaylistModal,
} from '../components/PlaylistModals';
import { AudioTrack } from '../types/music';

interface LibraryScreenProps {
  onNavigateExplore: () => void;
}

type FilterChip = 'all' | 'favorites' | 'offline';

export const LibraryScreen: React.FC<LibraryScreenProps> = ({ onNavigateExplore }) => {
  const {
    isOnline,
    canInstall,
    promptInstall,
    libraryTracks,
    favoriteIds,
    currentTrack,
    getTrackArtworkUrl,
    playTrack,
    playQueue,
    playNextInQueue,
    addToQueue,
    isFavorite,
    toggleFavorite,
    importLocalFiles,
    removeTrack,
    setPlayerModalVisible,
  } = usePlayer();

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterChip, setFilterChip] = useState<FilterChip>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [isCreatePlaylistVisible, setIsCreatePlaylistVisible] = useState(false);
  const [trackForPlaylist, setTrackForPlaylist] = useState<AudioTrack | null>(null);
  const [isAddToPlaylistVisible, setIsAddToPlaylistVisible] = useState(false);
  const [menuTrack, setMenuTrack] = useState<AudioTrack | null>(null);
  const [pendingDeleteTrack, setPendingDeleteTrack] = useState<AudioTrack | null>(null);

  const filteredTracks = useMemo(() => {
    let base = libraryTracks;
    if (filterChip === 'favorites') {
      base = libraryTracks.filter((t) => favoriteIds.includes(t.id));
    } else if (filterChip === 'offline') {
      base = libraryTracks.filter(
        (t) => t.sourceType === 'local' || t.sourceType === 'downloaded'
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [libraryTracks, favoriteIds, filterChip, searchQuery]);

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

  const hiddenInputs = (
    <>
      <input
        ref={folderInputRef}
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,image/*,.mp3,.m4a,.wav,.aac,.flac,.ogg,.opus,.lrc,.txt"
        style={{ display: 'none' }}
        onChange={handleFilesSelected}
      />
    </>
  );

  // Clean First-Run Empty Onboarding Screen matching APK v2.0.7
  if (libraryTracks.length === 0) {
    return (
      <div
        className={`screen-scroll onboarding-scroll ${isDragging ? 'dropzone-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDragging) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {hiddenInputs}

        <header className="screen-header">
          <div className="screen-title-wrap">
            <h1 className="screen-title" style={{ fontSize: 22 }}>
              Player 2.0
            </h1>
            {!isOnline && (
              <span className="status-badge offline">
                <WifiOff size={12} />
                Offline
              </span>
            )}
          </div>

          <div className="header-actions">
            {canInstall && (
              <button type="button" className="install-pill-btn" onClick={promptInstall}>
                <Download size={13} />
                Instalar
              </button>
            )}
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
              className="icon-btn"
              aria-label="Configurações"
              onClick={() => setIsSettingsVisible(true)}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <div className="onboarding-hero">
          <div className="onboarding-ring">
            <div className="onboarding-circle">
              <FolderPlus size={38} color="#09090b" />
            </div>
          </div>

          <h2 className="onboarding-title">Suas músicas, offline</h2>
          <p className="onboarding-desc">
            Selecione a pasta onde você salva suas músicas ou arraste arquivos para cá para ouvir 100% offline.
          </p>

          <button
            type="button"
            className="onboarding-cta-btn"
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderPlus size={19} />
            <span>Selecionar Pasta</span>
          </button>

          <div className="onboarding-links">
            <button
              type="button"
              className="onboarding-link-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar arquivos avulsos
            </button>
            <button
              type="button"
              className="onboarding-link-btn"
              onClick={onNavigateExplore}
            >
              Explorar músicas online
            </button>
          </div>

          <div className="onboarding-info-card">
            <div className="onboarding-info-icon">
              <Zap size={17} color="var(--primary)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div className="setting-title" style={{ fontSize: 13.5 }}>
                Sincronização instantânea
              </div>
              <div className="setting-desc">
                MP3, FLAC, WAV e AAC armazenados no IndexedDB para tocar sem internet
              </div>
            </div>
          </div>
        </div>

        <SettingsModal
          visible={isSettingsVisible}
          onClose={() => setIsSettingsVisible(false)}
          onPickFolder={() => folderInputRef.current?.click()}
          onPickFiles={() => fileInputRef.current?.click()}
        />
        <HelpModal
          visible={isHelpVisible}
          onClose={() => setIsHelpVisible(false)}
        />
      </div>
    );
  }

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
      {hiddenInputs}

      {/* Minimal Header (Search, Help, Settings only — matching APK v2.0.7) */}
      <header className="screen-header">
        <div className="screen-title-wrap">
          <h1 className="screen-title">Biblioteca</h1>
          {!isOnline && (
            <span className="status-badge offline">
              <WifiOff size={12} />
              Offline
            </span>
          )}
        </div>

        <div className="header-actions">
          {canInstall && (
            <button type="button" className="install-pill-btn" onClick={promptInstall}>
              <Download size={13} />
              Instalar
            </button>
          )}
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
            className="icon-btn"
            aria-label="Configurações"
            onClick={() => setIsSettingsVisible(true)}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {isSearching && (
        <div className="search-box search-bar-wrap">
          <Search size={16} color="var(--text-muted)" />
          <input
            className="search-inline-input"
            placeholder="Filtrar por título, artista ou álbum..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')}>
              <X size={15} color="var(--text-muted)" />
            </button>
          )}
        </div>
      )}

      {/* Quick Filter Pills: Todas / Favoritas / Offline */}
      <div className="filter-pills-row">
        <button
          type="button"
          className={`filter-pill ${filterChip === 'all' ? 'active' : ''}`}
          onClick={() => setFilterChip('all')}
        >
          Todas
        </button>
        <button
          type="button"
          className={`filter-pill ${filterChip === 'favorites' ? 'active' : ''}`}
          onClick={() => setFilterChip('favorites')}
        >
          Favoritas ({favoriteIds.length})
        </button>
        <button
          type="button"
          className={`filter-pill ${filterChip === 'offline' ? 'active' : ''}`}
          onClick={() => setFilterChip('offline')}
        >
          Offline
        </button>
      </div>

      {/* Play All & Shuffle Action Bar */}
      <div className="library-playbar">
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="pill-primary-btn"
            onClick={async () => {
              if (filteredTracks.length === 0) return;
              await playQueue(filteredTracks, 0);
              setPlayerModalVisible(true);
            }}
            disabled={filteredTracks.length === 0}
          >
            <Play size={15} fill="#000" />
            <span>Tocar Tudo</span>
          </button>

          <button
            type="button"
            className="pill-secondary-btn"
            onClick={handleShufflePlayAll}
            disabled={filteredTracks.length === 0}
          >
            <Shuffle size={15} />
            <span>Aleatório</span>
          </button>
        </div>

        <span className="track-count-meta">
          {filteredTracks.length} {filteredTracks.length === 1 ? 'faixa' : 'faixas'}
        </span>
      </div>

      {filteredTracks.length === 0 ? (
        <div className="empty-box">
          <Music size={34} color="var(--text-muted)" />
          <h2 className="empty-title">
            {filterChip === 'favorites'
              ? 'Nenhuma música favorita ainda'
              : 'Nenhuma faixa encontrada'}
          </h2>
          <p className="empty-subtitle">
            {filterChip === 'favorites'
              ? 'Toque no coração em qualquer música para adicioná-la aqui.'
              : 'Tente outro termo de busca ou importe mais arquivos nas Configurações.'}
          </p>
        </div>
      ) : (
        <div className="track-list">
          {filteredTracks.map((item) => {
            const active = currentTrack?.id === item.id;
            const art = getTrackArtworkUrl(item);
            const fav = isFavorite(item.id);
            return (
              <div
                key={item.id}
                className={`track-card ${active ? 'active' : ''}`}
                onClick={async () => {
                  await playTrack(item, filteredTracks);
                  setPlayerModalVisible(true);
                }}
                role="button"
                tabIndex={0}
              >
                {art ? (
                  <img src={art} alt={item.name} className="track-art" />
                ) : (
                  <div className="track-art-placeholder">
                    <Music size={19} />
                  </div>
                )}

                <div className="track-info">
                  <div className="track-title">
                    {item.name}
                    {active && <span className="playing-dot" />}
                  </div>
                  <div className="track-sub">
                    {item.artist}
                    {item.folderName ? ` • ${item.folderName}` : item.album ? ` • ${item.album}` : ''}
                  </div>
                </div>

                <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="small-icon-btn"
                    aria-label="Favoritar"
                    onClick={() => toggleFavorite(item.id)}
                  >
                    <Heart
                      size={16}
                      color={fav ? 'var(--primary)' : 'var(--text-muted)'}
                      fill={fav ? 'var(--primary)' : 'none'}
                    />
                  </button>

                  <button
                    type="button"
                    className="small-icon-btn"
                    aria-label={`Opções para ${item.name}`}
                    onClick={() => setMenuTrack(item)}
                  >
                    <MoreVertical size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SettingsModal
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
        onPickFolder={() => folderInputRef.current?.click()}
        onPickFiles={() => fileInputRef.current?.click()}
      />
      <HelpModal
        visible={isHelpVisible}
        onClose={() => setIsHelpVisible(false)}
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
        onClose={() => {
          setIsAddToPlaylistVisible(false);
          setTrackForPlaylist(null);
        }}
        onCreateNew={() => {
          setIsAddToPlaylistVisible(false);
          setIsCreatePlaylistVisible(true);
        }}
      />

      {/* Track Action Sheet (Tocar a seguir, Fila, Favoritar, Playlist, Remover) */}
      {menuTrack && (
        <div className="modal-backdrop" onClick={() => setMenuTrack(null)}>
          <div className="dialog-card action-sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="action-sheet-header">
              <div className="track-title">{menuTrack.name}</div>
              <div className="track-sub">{menuTrack.artist}</div>
            </div>

            <button
              type="button"
              className="action-sheet-row"
              onClick={() => {
                void playNextInQueue(menuTrack);
                setMenuTrack(null);
              }}
            >
              <PlayCircle size={18} color="var(--primary)" />
              <span>Tocar a seguir</span>
            </button>

            <button
              type="button"
              className="action-sheet-row"
              onClick={() => {
                void addToQueue(menuTrack);
                setMenuTrack(null);
              }}
            >
              <ListPlus size={18} color="var(--text-secondary)" />
              <span>Adicionar à fila</span>
            </button>

            <button
              type="button"
              className="action-sheet-row"
              onClick={() => {
                toggleFavorite(menuTrack.id);
                setMenuTrack(null);
              }}
            >
              <Heart
                size={18}
                color={isFavorite(menuTrack.id) ? 'var(--primary)' : 'var(--text-secondary)'}
                fill={isFavorite(menuTrack.id) ? 'var(--primary)' : 'none'}
              />
              <span>
                {isFavorite(menuTrack.id)
                  ? 'Remover das Favoritas'
                  : 'Adicionar às Favoritas'}
              </span>
            </button>

            <button
              type="button"
              className="action-sheet-row"
              onClick={() => {
                setTrackForPlaylist(menuTrack);
                setIsAddToPlaylistVisible(true);
                setMenuTrack(null);
              }}
            >
              <ListMusic size={18} color="var(--text-secondary)" />
              <span>Adicionar à playlist</span>
            </button>

            <button
              type="button"
              className="action-sheet-row danger"
              onClick={() => {
                setPendingDeleteTrack(menuTrack);
                setMenuTrack(null);
              }}
            >
              <Trash2 size={18} color="var(--danger)" />
              <span>Remover da biblioteca</span>
            </button>

            <button
              type="button"
              className="pill-secondary-btn"
              style={{ width: '100%', marginTop: 10 }}
              onClick={() => setMenuTrack(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {pendingDeleteTrack && (
        <div className="modal-backdrop" onClick={() => setPendingDeleteTrack(null)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">Remover da Biblioteca</h3>
            <p className="setting-desc" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              Remover &quot;{pendingDeleteTrack.name}&quot; do player?
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="pill-secondary-btn"
                onClick={() => setPendingDeleteTrack(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pill-primary-btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={() => {
                  void removeTrack(pendingDeleteTrack.id);
                  setPendingDeleteTrack(null);
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
