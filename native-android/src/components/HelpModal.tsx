import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, FileAudio, Image as ImageIcon, AlignLeft, Sparkles } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../theme/theme';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ visible, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <ChevronDown color={COLORS.text} size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guia de Uso</Text>
          <View style={styles.closeBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <FileAudio color={COLORS.primary} size={20} />
              <Text style={styles.cardTitle}>Pastas & Sincronização</Text>
            </View>
            <Text style={styles.cardText}>
              Selecione uma pasta com suas músicas para importá-las automaticamente. Sempre que você adicionar novos arquivos nela, eles aparecerão na biblioteca. Você pode adicionar ou alterar pastas em{' '}
              <Text style={styles.highlight}>Configurações ⚙</Text>.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <ImageIcon color={COLORS.primary} size={20} />
              <Text style={styles.cardTitle}>Capas em Alta Definição</Text>
            </View>
            <Text style={styles.cardText}>
              O Player 2.0 lê primeiro a capa embutida no MP3/FLAC ou o arquivo `cover.jpg` da pasta. Caso falte alguma capa ou letra, você pode usar a opção discreta{' '}
              <Text style={styles.highlight}>Puxar capas e letras faltantes</Text> dentro de Configurações.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AlignLeft color={COLORS.primary} size={20} />
              <Text style={styles.cardTitle}>Letras Sincronizadas & Tradução</Text>
            </View>
            <Text style={styles.cardText}>
              Toque em qualquer linha da letra para pular para aquele trecho, ajuste a sincronia em `-0.5s / +0.5s` ou toque em{' '}
              <Text style={styles.highlight}>Traduzir</Text> para acompanhar a letra traduzida para o português em tempo real!
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Sparkles color={COLORS.primary} size={20} />
              <Text style={styles.cardTitle}>Explorar, Pesquisar & Playlists</Text>
            </View>
            <Text style={styles.cardText}>
              Use a aba <Text style={styles.highlight}>Explorar</Text> para pesquisar músicas online, ouvir em streaming ou baixar 100% offline. Suas playlists e Favoritas ficam na aba{' '}
              <Text style={styles.highlight}>Playlists</Text>.
            </Text>
          </View>
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
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  highlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
