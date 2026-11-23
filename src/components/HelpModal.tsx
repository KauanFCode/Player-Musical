import React from 'react';
import {
  AlignLeft,
  ChevronDown,
  Download,
  FileAudio,
  HardDrive,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose }) => {
  const { canInstall, promptInstall } = usePlayer();

  if (!visible) return null;

  return (
    <div className="sheet-modal-overlay" onClick={onClose}>
      <div
        className="modal-full sheet-modal"
        role="dialog"
        aria-label="Guia de Uso e Instalação"
        onClick={(e) => e.stopPropagation()}
      >
      <div className="modal-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Fechar guia"
          onClick={onClose}
        >
          <ChevronDown size={26} />
        </button>
        <h2 className="modal-header-title">Guia &amp; Instalação</h2>
        <div style={{ width: 38 }} />
      </div>

      <div className="modal-body-scroll">
        {canInstall && (
          <div
            className="settings-card"
            style={{
              marginBottom: 12,
              borderColor: 'var(--primary-border)',
              background: 'var(--primary-dim)',
            }}
          >
            <div className="setting-title" style={{ marginBottom: 6 }}>
              Pronto para instalar no seu dispositivo!
            </div>
            <div className="setting-desc" style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
              Instale o Wavy na tela inicial para abrir em tela cheia e usar 100%
              offline como um aplicativo nativo.
            </div>
            <button
              type="button"
              className="pill-primary-btn"
              style={{ width: '100%' }}
              onClick={promptInstall}
            >
              <Download size={16} />
              Instalar Aplicativo Agora
            </button>
          </div>
        )}

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <FileAudio size={19} color="var(--primary)" />
            <div className="setting-title">Importando Pastas &amp; Músicas Locais</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            Use <strong style={{ color: 'var(--primary)' }}>Selecionar Pasta</strong> na tela
            inicial ou em <strong>Configurações ⚙</strong> para importar pastas inteiras com
            capas (<code>cover.jpg</code> / ID3) e letras (<code>.lrc</code>). Você também pode
            arrastar músicas direto para o app!
          </div>
        </div>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AlignLeft size={19} color="var(--primary)" />
            <div className="setting-title">Letras Sincronizadas &amp; Tradução PT-BR</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            As letras aparecem centralizadas no meio da tela. Toque em qualquer verso para pular
            para aquele trecho, ajuste a sincronia em <code>-0.5s / +0.5s</code> ou toque em{' '}
            <strong style={{ color: 'var(--primary)' }}>Traduzir</strong> para ver a tradução em
            português em tempo real!
          </div>
        </div>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Sparkles size={19} color="var(--primary)" />
            <div className="setting-title">Playlists, Fila &amp; Explorar</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            Gerencie playlists e suas Favoritas na aba{' '}
            <strong style={{ color: 'var(--primary)' }}>Playlists</strong>, pesquise e baixe músicas
            online na aba <strong style={{ color: 'var(--primary)' }}>Explorar</strong> e puxe
            capas faltantes de forma discreta em Configurações.
          </div>
        </div>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Smartphone size={19} color="var(--primary)" />
            <div className="setting-title">App Android Nativo (.APK)</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13, marginBottom: 12 }}>
            Prefere instalar direto como aplicativo Android nativo com leitura de pastas em segundo
            plano? Baixe o APK oficial do <strong style={{ color: 'var(--primary)' }}>Wavy (v2.0.8)</strong>:
          </div>
          <a
            href="./Wavy-v2.0.8.apk"
            download="Wavy-v2.0.8.apk"
            className="pill-primary-btn"
            style={{ width: '100%', textDecoration: 'none' }}
          >
            <Download size={16} />
            Baixar APK Android (v2.0.8)
          </a>
        </div>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Smartphone size={19} color="var(--primary)" />
            <div className="setting-title">Como Instalar o PWA pelo Navegador</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            <strong style={{ color: 'var(--text)' }}>Android (Chrome / Edge):</strong>{' '}
            Menu <strong>⋮</strong> → <strong style={{ color: 'var(--primary)' }}>Instalar aplicativo</strong>.
            <br />
            <strong style={{ color: 'var(--text)' }}>iPhone / iPad (Safari):</strong>{' '}
            <strong>Compartilhar</strong> → <strong style={{ color: 'var(--primary)' }}>Adicionar à Tela de Início</strong>.
          </div>
        </div>

        <div className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <HardDrive size={19} color="var(--primary)" />
            <div className="setting-title">100% Offline (IndexedDB + Service Worker)</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            Toda a interface e suas músicas importadas ou baixadas permanecem salvas no dispositivo
            para tocar mesmo sem internet.
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
