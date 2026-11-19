import React, { useEffect, useState } from 'react';
import { ChevronDown, HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { getStorageEstimate } from '../utils/db';
import { LyricFontSize } from '../types/music';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

function formatMB(bytes: number): string {
  if (!bytes || bytes <= 0) return '0,0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const { settings, updateSettings, clearCache, clearAllData } = usePlayer();
  const [storageInfo, setStorageInfo] = useState({
    usedBytes: 0,
    quotaBytes: 0,
    persisted: false,
  });
  const [confirmMode, setConfirmMode] = useState<'none' | 'cache' | 'all'>('none');

  const refreshStorage = async () => {
    const est = await getStorageEstimate();
    setStorageInfo(est);
  };

  useEffect(() => {
    if (visible) {
      setConfirmMode('none');
      refreshStorage();
    }
  }, [visible]);

  if (!visible) return null;

  const fontOptions: { label: string; value: LyricFontSize }[] = [
    { label: 'Pequena', value: 'small' },
    { label: 'Média', value: 'medium' },
    { label: 'Grande', value: 'large' },
  ];

  return (
    <div className="modal-full" role="dialog" aria-label="Configurações">
      <div className="modal-header">
        <button
          type="button"
          className="icon-btn"
          aria-label="Fechar configurações"
          onClick={onClose}
        >
          <ChevronDown size={26} />
        </button>
        <h2 className="modal-header-title">Configurações</h2>
        <div style={{ width: 38 }} />
      </div>

      <div className="modal-body-scroll">
        <div className="section-label" style={{ marginTop: 4 }}>
          Capas e Metadados
        </div>
        <div className="settings-card">
          <div className="setting-row">
            <div>
              <div className="setting-title">Buscar capas automaticamente</div>
              <div className="setting-desc">Procura capas HD ao tocar músicas sem capa</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autoFetchArtwork}
                onChange={(e) => updateSettings({ autoFetchArtwork: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>

          <div className="setting-divider" />

          <div className="setting-row">
            <div>
              <div className="setting-title">Preferir capa embutida (ID3)</div>
              <div className="setting-desc">Usa a imagem salva dentro do arquivo MP3</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.preferEmbeddedArtwork}
                onChange={(e) =>
                  updateSettings({ preferEmbeddedArtwork: e.target.checked })
                }
              />
              <span className="switch-track" />
            </label>
          </div>

          <div className="setting-divider" />

          <div className="setting-row">
            <div>
              <div className="setting-title">Capas em Alta Definição (1280px)</div>
              <div className="setting-desc">Qualidade máxima para capas baixadas</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.hdArtworkQuality}
                onChange={(e) => updateSettings({ hdArtworkQuality: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>

          <div className="setting-divider" />

          <div className="setting-row">
            <div>
              <div className="setting-title">Animação na capa</div>
              <div className="setting-desc">Pulso suave na capa enquanto a música toca</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.pulseCoverAnimation}
                onChange={(e) =>
                  updateSettings({ pulseCoverAnimation: e.target.checked })
                }
              />
              <span className="switch-track" />
            </label>
          </div>
        </div>

        <div className="section-label">Letras</div>
        <div className="settings-card">
          <div className="setting-row">
            <div>
              <div className="setting-title">Buscar letras automaticamente</div>
              <div className="setting-desc">Busca letras sincronizadas (.lrc) via LRCLIB</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autoFetchLyrics}
                onChange={(e) => updateSettings({ autoFetchLyrics: e.target.checked })}
              />
              <span className="switch-track" />
            </label>
          </div>

          <div className="setting-divider" />

          <div className="setting-title">Tamanho da fonte da letra</div>
          <div className="segment-row">
            {fontOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`segment-btn ${
                  settings.lyricFontSize === opt.value ? 'active' : ''
                }`}
                onClick={() => updateSettings({ lyricFontSize: opt.value })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="section-label">Armazenamento Offline</div>
        <div className="settings-card" style={{ marginBottom: 12 }}>
          <div className="setting-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardDrive size={20} color="var(--primary)" />
              <div>
                <div className="setting-title">
                  {formatMB(storageInfo.usedBytes)} usados offline
                </div>
                <div className="setting-desc">
                  {storageInfo.quotaBytes > 0
                    ? `Disponível: até ${formatMB(storageInfo.quotaBytes)}`
                    : 'Salvo no IndexedDB local do navegador'}
                </div>
              </div>
            </div>

            {storageInfo.persisted && (
              <span className="status-badge" style={{ color: 'var(--primary)' }}>
                <ShieldCheck size={13} />
                Persistente
              </span>
            )}
          </div>
        </div>

        {confirmMode === 'cache' ? (
          <div className="settings-card" style={{ marginBottom: 10 }}>
            <div className="setting-title" style={{ marginBottom: 10 }}>
              Apagar todas as capas e letras salvas em cache?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="pill-secondary-btn"
                style={{ flex: 1 }}
                onClick={() => setConfirmMode('none')}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pill-primary-btn"
                style={{ flex: 1, background: 'var(--danger)', color: '#fff' }}
                onClick={async () => {
                  await clearCache();
                  setConfirmMode('none');
                  refreshStorage();
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="danger-outline-btn"
            style={{ marginBottom: 10 }}
            onClick={() => setConfirmMode('cache')}
          >
            <Trash2 size={17} />
            Limpar Cache de Capas e Letras
          </button>
        )}

        {confirmMode === 'all' ? (
          <div className="settings-card">
            <div className="setting-title" style={{ marginBottom: 10 }}>
              Apagar TODAS as músicas baixadas e playlists offline?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="pill-secondary-btn"
                style={{ flex: 1 }}
                onClick={() => setConfirmMode('none')}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pill-primary-btn"
                style={{ flex: 1, background: 'var(--danger)', color: '#fff' }}
                onClick={async () => {
                  await clearAllData();
                  setConfirmMode('none');
                  refreshStorage();
                }}
              >
                Apagar Tudo
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="danger-outline-btn"
            onClick={() => setConfirmMode('all')}
          >
            <Trash2 size={17} />
            Zerar Biblioteca Offline
          </button>
        )}
      </div>
    </div>
  );
};
