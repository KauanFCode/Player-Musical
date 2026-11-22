import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Compass,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { usePlayer } from '../context/PlayerContext';
import { getAssetsCacheSizeMb } from '../utils/assetCache';
import { COLORS, RADIUS, SPACING } from '../theme/theme';
import { LyricFontSize } from '../types/music';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const formatFolderDisplay = (uri: string): { title: string; subtitle: string } => {
  const decoded = decodeURIComponent(uri);
  const cleaned = decoded.replace(/^file:\/\//, '');
  const parts = cleaned.split('/').filter(Boolean);
  const title = parts[parts.length - 1] || cleaned;
  return { title, subtitle: cleaned };
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const {
    settings,
    updateSettings,
    clearAllCache,
    watchedFolders,
    importFolder,
    syncWatchedFolders,
    removeWatchedFolder,
    isScanningFolders,
    isSyncingAssets,
    syncProgress,
    syncAllLibraryAssets,
    replayTour,
  } = usePlayer();

  const [cacheSizeMb, setCacheSizeMb] = useState<number>(0);

  const refreshCacheSize = async () => {
    const mb = await getAssetsCacheSizeMb();
    setCacheSizeMb(mb);
  };

  useEffect(() => {
    if (visible) {
      refreshCacheSize();
    }
  }, [visible, isSyncingAssets]);

  const handleClearCache = () => {
    Alert.alert(
      'Limpar Cache Offline',
      'Deseja apagar todas as capas, letras e traduções salvas em cache?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            await refreshCacheSize();
            Alert.alert('Concluído', 'Cache offline limpo com sucesso.');
          },
        },
      ]
    );
  };

  const handleRemoveFolder = (folderUri: string, label: string) => {
    Alert.alert(
      'Remover Pasta',
      `Parar de monitorar "${label}"? As músicas já importadas permanecerão na biblioteca até serem removidas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => removeWatchedFolder(folderUri),
        },
      ]
    );
  };

  const handleSyncAssets = async () => {
    await syncAllLibraryAssets();
    await refreshCacheSize();
  };

  const handleReplayTour = () => {
    onClose();
    setTimeout(() => {
      replayTour();
    }, 220);
  };

  const fontOptions: { label: string; value: LyricFontSize }[] = [
    { label: 'Pequena', value: 'small' },
    { label: 'Média', value: 'medium' },
    { label: 'Grande', value: 'large' },
  ];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <ChevronDown color={COLORS.text} size={28} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Configurações</Text>
            <View style={styles.closeBtn} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {/* PASTA DE MÚSICAS */}
            <Text style={styles.sectionTitle}>Pasta de Músicas</Text>
            <View style={styles.card}>
              {watchedFolders.length === 0 ? (
                <Text style={styles.emptyFolderText}>
                  Nenhuma pasta selecionada ainda. Adicione sua pasta de músicas para sincronização automática.
                </Text>
              ) : (
                <View style={styles.folderList}>
                  {watchedFolders.map((folder) => {
                    const info = formatFolderDisplay(folder.uri);
                    return (
                      <View key={folder.uri} style={styles.folderItem}>
                        <FolderOpen color={COLORS.primary} size={18} />
                        <View style={styles.folderInfo}>
                          <Text style={styles.folderName} numberOfLines={1}>
                            {folder.name || info.title}
                          </Text>
                          <Text style={styles.folderPath} numberOfLines={1}>
                            {info.subtitle}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.folderRemoveBtn}
                          onPress={() => handleRemoveFolder(folder.uri, folder.name || info.title)}
                          accessibilityLabel={`Remover pasta ${folder.name || info.title}`}
                        >
                          <X color={COLORS.textMuted} size={16} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.folderActionsRow}>
                <TouchableOpacity
                  style={styles.primaryCompactBtn}
                  onPress={importFolder}
                  disabled={isScanningFolders}
                >
                  <FolderPlus color={COLORS.black} size={16} />
                  <Text style={styles.primaryCompactBtnText}>
                    {watchedFolders.length > 0 ? 'Adicionar Pasta' : 'Selecionar Pasta'}
                  </Text>
                </TouchableOpacity>

                {watchedFolders.length > 0 && (
                  <TouchableOpacity
                    style={styles.secondaryCompactBtn}
                    onPress={() => syncWatchedFolders(true)}
                    disabled={isScanningFolders}
                  >
                    {isScanningFolders ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <RefreshCw color={COLORS.textSecondary} size={16} />
                    )}
                    <Text style={styles.secondaryCompactBtnText}>Verificar</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Sincronizar novas faixas ao abrir</Text>
                  <Text style={styles.rowDesc}>
                    Detecta automaticamente novas músicas adicionadas nas suas pastas
                  </Text>
                </View>
                <Switch
                  value={settings.autoSyncFoldersOnOpen}
                  onValueChange={(v) => updateSettings({ autoSyncFoldersOnOpen: v })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            {/* CAPAS E LETRAS */}
            <Text style={styles.sectionTitle}>Capas e Letras</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Buscar capas automaticamente</Text>
                  <Text style={styles.rowDesc}>Procura capas HD ao importar ou tocar músicas</Text>
                </View>
                <Switch
                  value={settings.autoFetchArtwork}
                  onValueChange={(v) => updateSettings({ autoFetchArtwork: v })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Preferir capa embutida (ID3)</Text>
                  <Text style={styles.rowDesc}>Usa a imagem salva dentro do arquivo ou cover.jpg</Text>
                </View>
                <Switch
                  value={settings.preferEmbeddedArtwork}
                  onValueChange={(v) => updateSettings({ preferEmbeddedArtwork: v })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Capas em Alta Definição (1280px)</Text>
                  <Text style={styles.rowDesc}>Qualidade máxima para capas baixadas</Text>
                </View>
                <Switch
                  value={settings.hdArtworkQuality}
                  onValueChange={(v) => updateSettings({ hdArtworkQuality: v })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Animação na capa</Text>
                  <Text style={styles.rowDesc}>Pulso suave na capa enquanto a música toca</Text>
                </View>
                <Switch
                  value={settings.pulseCoverAnimation}
                  onValueChange={(v) => updateSettings({ pulseCoverAnimation: v })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>Buscar letras automaticamente</Text>
                  <Text style={styles.rowDesc}>Busca letras sincronizadas (.lrc) via LRCLIB</Text>
                </View>
                <Switch
                  value={settings.autoFetchLyrics}
                  onValueChange={(v) => updateSettings({ autoFetchLyrics: v })}
                  trackColor={{ false: COLORS.border, true: COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={styles.divider} />

              {/* Discrete inline sync row */}
              <TouchableOpacity
                style={styles.discreteRow}
                onPress={handleSyncAssets}
                disabled={isSyncingAssets}
                activeOpacity={0.7}
              >
                <View style={styles.discreteLeft}>
                  <Sparkles color={COLORS.primary} size={16} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Puxar capas e letras faltantes</Text>
                    <Text style={styles.rowDesc}>
                      {isSyncingAssets && syncProgress
                        ? `Sincronizando ${syncProgress.current} de ${syncProgress.total}...`
                        : 'Busca em segundo plano apenas para faixas sem capa ou letra'}
                    </Text>
                  </View>
                </View>
                <View style={styles.discretePill}>
                  {isSyncingAssets ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Text style={styles.discretePillText}>Puxar</Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* GERAL */}
            <Text style={styles.sectionTitle}>Geral</Text>
            <View style={styles.card}>
              <Text style={[styles.rowTitle, { marginBottom: 10 }]}>Tamanho da fonte da letra</Text>
              <View style={styles.segmentRow}>
                {fontOptions.map((opt) => {
                  const active = settings.lyricFontSize === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      onPress={() => updateSettings({ lyricFontSize: opt.value })}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.discreteRow}
                onPress={handleReplayTour}
                activeOpacity={0.7}
              >
                <View style={styles.discreteLeft}>
                  <Compass color={COLORS.primary} size={17} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Rever Tour do App</Text>
                    <Text style={styles.rowDesc}>
                      Mostra novamente a introdução rápida das telas principais
                    </Text>
                  </View>
                </View>
                <View style={styles.discretePill}>
                  <Text style={styles.discretePillText}>Abrir</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* ARMAZENAMENTO */}
            <Text style={styles.sectionTitle}>Armazenamento</Text>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleClearCache}>
              <Trash2 color={COLORS.danger} size={18} />
              <Text style={styles.dangerBtnText}>
                Limpar Cache Offline ({cacheSizeMb.toFixed(1)} MB)
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 14,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyFolderText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  folderList: {
    gap: 8,
    marginBottom: 12,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  folderPath: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  folderRemoveBtn: {
    padding: 4,
  },
  folderActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryCompactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  primaryCompactBtnText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryCompactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  secondaryCompactBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  rowInfo: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  rowDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  discreteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 2,
  },
  discreteLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discretePill: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  discretePillText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segmentText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: COLORS.black,
    fontWeight: '700',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.dangerDim,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: RADIUS.md,
    padding: 14,
  },
  dangerBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
