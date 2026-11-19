import React from 'react';
import {
  AlignLeft,
  ChevronDown,
  Download,
  FileAudio,
  HardDrive,
  Smartphone,
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
    <div className="modal-full" role="dialog" aria-label="Guia de Uso e Instalação">
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
              Instale o Player 2.0 na tela inicial para abrir em tela cheia e usar 100%
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
            <Smartphone size={19} color="var(--primary)" />
            <div className="setting-title">Como Instalar pelo Navegador</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            <strong style={{ color: 'var(--text)' }}>Android (Chrome / Edge):</strong>{' '}
            Toque no menu <strong>⋮</strong> (três pontinhos) →{' '}
            <strong style={{ color: 'var(--primary)' }}>Instalar aplicativo</strong> ou{' '}
            <strong style={{ color: 'var(--primary)' }}>Adicionar à tela inicial</strong>.
            <br />
            <strong style={{ color: 'var(--text)' }}>iPhone / iPad (Safari):</strong>{' '}
            Toque em <strong>Compartilhar</strong> (ícone da seta para cima) →{' '}
            <strong style={{ color: 'var(--primary)' }}>Adicionar à Tela de Início</strong>.
          </div>
        </div>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <HardDrive size={19} color="var(--primary)" />
            <div className="setting-title">100% Offline (IndexedDB + Service Worker)</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            Após abrir o app uma vez, toda a interface fica salva no cache do navegador e
            abre mesmo em Modo Avião. As músicas importadas e baixadas ficam armazenadas
            localmente no IndexedDB do seu dispositivo.
          </div>
        </div>

        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <FileAudio size={19} color="var(--primary)" />
            <div className="setting-title">Importando Músicas Locais</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            Toque em <strong>Arquivos</strong> e selecione seus arquivos{' '}
            <code>.mp3</code>, <code>.m4a</code>, <code>.wav</code>, <code>.flac</code> ou{' '}
            <code>.ogg</code> (junto com <code>.lrc</code> e capa se quiser). O app lê
            automaticamente tags ID3v2 e capa embutida, ou usa o padrão{' '}
            <strong style={{ color: 'var(--primary)' }}>Artista - Música.mp3</strong>.
          </div>
        </div>

        <div className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <AlignLeft size={19} color="var(--primary)" />
            <div className="setting-title">Letras Sincronizadas (.lrc)</div>
          </div>
          <div className="setting-desc" style={{ lineHeight: 1.6, fontSize: 13 }}>
            Toque em qualquer linha da letra no player para pular diretamente para aquele
            momento da música!
          </div>
        </div>
      </div>
    </div>
  );
};
