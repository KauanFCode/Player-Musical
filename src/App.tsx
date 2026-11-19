import React, { useState } from 'react';
import { Compass, Library } from 'lucide-react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { MiniPlayer } from './components/MiniPlayer';
import { PlayerModal } from './components/PlayerModal';
import { LibraryScreen } from './screens/LibraryScreen';
import { ExploreScreen } from './screens/ExploreScreen';

type AppTab = 'library' | 'explore';

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

      {activeTab === 'library' ? <LibraryScreen /> : <ExploreScreen />}

      <MiniPlayer />

      <nav className="bottom-nav" aria-label="Navegação principal">
        <button
          type="button"
          className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          <Library size={21} />
          <span>Biblioteca</span>
        </button>

        <button
          type="button"
          className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
          onClick={() => setActiveTab('explore')}
        >
          <Compass size={21} />
          <span>Explorar</span>
        </button>
      </nav>

      <PlayerModal />
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
