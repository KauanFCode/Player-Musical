import React, { useState } from 'react';
import { Compass, Disc3, Library, ListMusic } from 'lucide-react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { MiniPlayer } from './components/MiniPlayer';
import { PlayerModal } from './components/PlayerModal';
import { TourOverlay } from './components/TourOverlay';
import { LibraryScreen } from './screens/LibraryScreen';
import { PlaylistsScreen } from './screens/PlaylistsScreen';
import { ExploreScreen } from './screens/ExploreScreen';

type AppTab = 'library' | 'playlists' | 'explore';

const AppShell: React.FC = () => {
  const { toast } = usePlayer();
  const [activeTab, setActiveTab] = useState<AppTab>('library');

  return (
    <div className="app-shell">
      {toast && (
        <div key={toast.id} className={`toast-banner ${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      {activeTab === 'library' && (
        <LibraryScreen onNavigateExplore={() => setActiveTab('explore')} />
      )}
      {activeTab === 'playlists' && <PlaylistsScreen />}
      {activeTab === 'explore' && <ExploreScreen />}

      <MiniPlayer />

      <nav className="bottom-nav" aria-label="Navegação principal">
        <div className="sidebar-brand" aria-hidden="true">
          <span className="sidebar-brand-icon">
            <Disc3 size={20} color="#09090b" />
          </span>
          <div>
            <div className="sidebar-brand-title">Player 2.0</div>
            <div className="sidebar-brand-sub">PWA Offline</div>
          </div>
        </div>

        <button
          type="button"
          className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          <Library size={20} />
          <span>Biblioteca</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'playlists' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlists')}
        >
          <ListMusic size={20} />
          <span>Playlists</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <Compass size={20} />
          <span>Explorar</span>
        </button>
      </nav>

      <PlayerModal />
      <TourOverlay />
    </div>
  );
};

export default function App() {
  return (
    <PlayerProvider>
      <AppShell />
    </PlayerProvider>
  );
}
