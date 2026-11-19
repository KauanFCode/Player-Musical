import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ListMusic,
  Music,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { AudioTrack, Playlist } from '../types/music';

interface CreatePlaylistModalProps {
  visible: boolean;
  initialTrack?: AudioTrack | null;
  onClose: () => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  visible,
  initialTrack,
  onClose,
}) => {
  const { createPlaylist, showToast } = usePlayer();
  const [name, setName] = useState('');

  if (!visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Digite um nome para a playlist.', 'error');
      return;
    }
    await createPlaylist(name, initialTrack?.id);
    setName('');
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="dialog-card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 className="dialog-title">Nova Playlist</h3>
        <input
          className="search-input"
          placeholder="Nome da playlist..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="dialog-actions">
          <button type="button" className="pill-secondary-btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="pill-primary-btn">
            Criar
          </button>
        </div>
      </form>
    </div>
  );
};

interface AddToPlaylistModalProps {
  visible: boolean;
  track: AudioTrack | null;
  onClose: () => void;
  onCreateNew: () => void;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  visible,
  track,
  onClose,
  onCreateNew,
}) => {
  const { userPlaylists, addTrackToPlaylist } = usePlayer();

  if (!visible || !track) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <h3 className="dialog-title" style={{ margin: 0 }}>
            Adicionar à Playlist
          </h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <ChevronDown size={22} />
          </button>
        </div>

        <div className="track-sub" style={{ marginBottom: 14 }}>
          {track.name}
        </div>

        <button
          type="button"
          className="pill-primary-btn"
          style={{ width: '100%', marginBottom: 12 }}
          onClick={() => {
            onClose();
            onCreateNew();
          }}
        >
          <Plus size={16} />
          Criar Nova Playlist
        </button>

        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {userPlaylists.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '18px 8px',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              Nenhuma playlist criada ainda.
            </div>
          ) : (
            <div className="track-list">
              {userPlaylists.map((pl) => {
                const added = pl.trackIds.includes(track.id);
                return (
                  <button
                    key={pl.id}
                    type="button"
                    className="track-card"
                    onClick={async () => {
                      await addTrackToPlaylist(pl.id, track.id);
                      onClose();
                    }}
                  >
                    <ListMusic size={20} color="var(--primary)" />
                    <div className="track-info">
                      <div className="track-title">{pl.name}</div>
                      <div className="track-sub">
                        {pl.trackIds.length} músicas {added ? '• Já adicionada' : ''}
                      </div>
                    </div>
                    {added && <Check size={17} color="var(--primary)" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface PlaylistDetailModalProps {
  playlist: Playlist | null;
  onClose: () => void;
}

export const PlaylistDetailModal: React.FC<PlaylistDetailModalProps> = ({
  playlist,
  onClose,
}) => {
  const {
    libraryTracks,
    userPlaylists,
    getTrackArtworkUrl,
    playQueue,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    setPlayerModalVisible,
    showToast,
  } = usePlayer();

  const [isPickerOpen, setIsPickerOpen] = useState(false);

  if (!playlist) return null;

  const currentPl = userPlaylists.find((p) => p.id === playlist.id) || playlist;
  const tracks = libraryTracks.filter((t) => currentPl.trackIds.includes(t.id));
  const availableToAdd = libraryTracks.filter(
    (t) => !currentPl.trackIds.includes(t.id)
  );

  const handlePlayAll = async () => {
    if (tracks.length === 0) {
      showToast('Adicione músicas à playlist primeiro.', 'info');
      return;
    }
    await playQueue(tracks, 0);
    onClose();
    setPlayerModalVisible(true);
  };

  return (
    <div className="modal-full" role="dialog" aria-label={currentPl.name}>
      <div className="modal-header">
        <button type="button" className="icon-btn" onClick={onClose}>
          <ChevronDown size={26} />
        </button>
        <h2
          className="modal-header-title"
          style={{
            flex: 1,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '0 8px',
          }}
        >
          {currentPl.name}
        </h2>
        <button
          type="button"
          className="pill-primary-btn"
          style={{ padding: '7px 14px' }}
          onClick={handlePlayAll}
        >
          <Play size={14} fill="currentColor" />
          Tocar
        </button>
      </div>

      <div className="modal-body-scroll">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span className="track-sub">
            {tracks.length} {tracks.length === 1 ? 'música' : 'músicas'}
          </span>
          <button
            type="button"
            className="chip-btn"
            onClick={() => setIsPickerOpen((p) => !p)}
          >
            <Plus size={14} />
            {isPickerOpen ? 'Fechar seleção' : 'Adicionar músicas'}
          </button>
        </div>

        {isPickerOpen && (
          <div className="settings-card" style={{ marginBottom: 14 }}>
            <div className="setting-title" style={{ marginBottom: 10 }}>
              Adicionar da Biblioteca
            </div>
            {availableToAdd.length === 0 ? (
              <div className="setting-desc">
                Todas as músicas da sua biblioteca já estão nesta playlist.
              </div>
            ) : (
              <div className="track-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                {availableToAdd.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="track-card"
                    onClick={() => addTrackToPlaylist(currentPl.id, t.id)}
                  >
                    <Plus size={16} color="var(--primary)" />
                    <div className="track-info">
                      <div className="track-title">{t.name}</div>
                      <div className="track-sub">{t.artist}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tracks.length === 0 ? (
          <div className="empty-box">
            <ListMusic size={38} color="var(--text-muted)" />
            <h3 className="empty-title">Esta playlist está vazia</h3>
            <p className="empty-subtitle">
              Toque em "Adicionar músicas" acima para montar sua playlist.
            </p>
          </div>
        ) : (
          <div className="track-list">
            {tracks.map((item, idx) => {
              const art = getTrackArtworkUrl(item);
              return (
                <div key={item.id} className="track-card">
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
                    onClick={async () => {
                      await playQueue(tracks, idx);
                      onClose();
                      setPlayerModalVisible(true);
                    }}
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

                  <button
                    type="button"
                    className="small-icon-btn danger"
                    aria-label={`Remover ${item.name} da playlist`}
                    onClick={() => removeTrackFromPlaylist(currentPl.id, item.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
