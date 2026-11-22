import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ChevronRight,
  Heart,
  ListMusic,
  Music,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import {
  CreatePlaylistModal,
  PlaylistDetailModal,
} from '../components/PlaylistModals';
import { Playlist } from '../types/music';

export const PlaylistsScreen: React.FC = () => {
  const {
    libraryTracks,
    userPlaylists,
    favoriteIds,
    getTrackArtworkUrl,
    playQueue,
    deletePlaylist,
    setPlayerModalVisible,
    showToast,
  } = usePlayer();

  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Playlist | null>(null);

  const favoriteTracks = useMemo(
    () => libraryTracks.filter((t) => favoriteIds.includes(t.id)),
    [libraryTracks, favoriteIds]
  );

  const sortedPlaylists = useMemo(() => {
    const copy = [...userPlaylists];
    if (sortBy === 'alpha') {
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
    return copy.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [userPlaylists, sortBy]);

  const handlePlayFavorites = async () => {
    if (favoriteTracks.length === 0) {
      showToast('Curta algumas músicas com o coração para preencher suas Favoritas.', 'info');
      return;
    }
    await playQueue(favoriteTracks, 0);
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
    <div className="screen-scroll">
      <header className="screen-header">
        <div className="screen-title-wrap">
          <h1 className="screen-title">Playlists</h1>
          <span className="count-pill">{userPlaylists.length}</span>
        </div>

        <button
          type="button"
          className="pill-primary-btn"
          style={{ padding: '8px 14px' }}
          onClick={() => setIsCreateVisible(true)}
        >
          <Plus size={16} />
          <span>Nova</span>
        </button>
      </header>

      {/* Auto Favorites Smart Playlist Card */}
      <button
        type="button"
        className="favorites-smart-card"
        onClick={handlePlayFavorites}
      >
        <div className="favorites-icon-box">
          <Heart size={24} fill="#09090b" color="#09090b" />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="track-title" style={{ fontSize: 15.5 }}>
              Músicas Favoritas
            </span>
            <span className="auto-badge">AUTO</span>
          </div>
          <div className="track-sub">
            {favoriteTracks.length} {favoriteTracks.length === 1 ? 'música' : 'músicas'}
          </div>
        </div>
        <span className="favorites-play-circle">
          <Play size={16} fill="#09090b" color="#09090b" />
        </span>
      </button>

      {/* Section Header */}
      <div className="playlists-sub-header">
        <span className="section-label" style={{ margin: 0 }}>
          Suas Playlists
        </span>
        <button
          type="button"
          className="sort-toggle-btn"
          onClick={() => setSortBy((s) => (s === 'recent' ? 'alpha' : 'recent'))}
        >
          <span>{sortBy === 'recent' ? 'Recentes' : 'A–Z'}</span>
          <ArrowDownUp size={13} />
        </button>
      </div>

      {sortedPlaylists.length === 0 ? (
        <div className="empty-box" style={{ borderStyle: 'solid' }}>
          <ListMusic size={34} color="var(--text-muted)" />
          <h2 className="empty-title">Nenhuma playlist personalizada</h2>
          <p className="empty-subtitle">
            Toque em &quot;+ Nova&quot; para organizar suas músicas por humor, treino ou estilo.
          </p>
        </div>
      ) : (
        <div className="track-list">
          {sortedPlaylists.map((pl) => {
            const firstTrack = libraryTracks.find((t) => pl.trackIds.includes(t.id));
            const cover = firstTrack ? getTrackArtworkUrl(firstTrack) : undefined;
            return (
              <div
                key={pl.id}
                className="track-card"
                onClick={() => setSelectedPlaylist(pl)}
                role="button"
                tabIndex={0}
              >
                {cover ? (
                  <img src={cover} alt={pl.name} className="track-art" />
                ) : (
                  <div className="track-art-placeholder">
                    {firstTrack ? <Music size={19} /> : <ListMusic size={20} color="var(--primary)" />}
                  </div>
                )}

                <div className="track-info">
                  <div className="track-title">{pl.name}</div>
                  <div className="track-sub">
                    {pl.trackIds.length} {pl.trackIds.length === 1 ? 'música' : 'músicas'}
                  </div>
                </div>

                <div className="track-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="small-icon-btn"
                    style={{ color: 'var(--primary)' }}
                    aria-label={`Tocar ${pl.name}`}
                    onClick={() => handlePlayPlaylist(pl)}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                  <button
                    type="button"
                    className="small-icon-btn danger"
                    aria-label={`Excluir ${pl.name}`}
                    onClick={() => setPendingDelete(pl)}
                  >
                    <Trash2 size={15} />
                  </button>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreatePlaylistModal
        visible={isCreateVisible}
        onClose={() => setIsCreateVisible(false)}
      />

      <PlaylistDetailModal
        playlist={
          selectedPlaylist
            ? userPlaylists.find((p) => p.id === selectedPlaylist.id) ?? selectedPlaylist
            : null
        }
        onClose={() => setSelectedPlaylist(null)}
      />

      {pendingDelete && (
        <div className="modal-backdrop" onClick={() => setPendingDelete(null)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="dialog-title">Excluir Playlist</h3>
            <p className="setting-desc" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              Excluir &quot;{pendingDelete.name}&quot;? As músicas permanecem na sua biblioteca.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="pill-secondary-btn"
                onClick={() => setPendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pill-primary-btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={() => {
                  void deletePlaylist(pendingDelete.id);
                  setPendingDelete(null);
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
