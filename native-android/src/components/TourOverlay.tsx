import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Sparkles, X } from 'lucide-react-native';
import { usePlayer } from '../context/PlayerContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../theme/theme';

interface TourStep {
  title: string;
  body: string;
  spotlightLabel: string;
  position: 'top' | 'center' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Sua Biblioteca e Fila',
    body: 'Filtre por Todas, Favoritas ou Offline, ou toque nos 3 pontinhos (⋮) de qualquer música para Tocar a seguir ou Adicionar à fila.',
    spotlightLabel: 'Filtros rápidos & menu da faixa',
    position: 'top',
  },
  {
    title: 'Controle rápido e abas',
    body: 'Alterne entre Biblioteca, Playlists e Explorar na barra inferior, ou arraste o MiniPlayer para os lados para trocar de música.',
    spotlightLabel: 'Player ativo & Navegação',
    position: 'bottom',
  },
  {
    title: 'Player, Letras e Tradução',
    body: 'Toque no MiniPlayer para abrir em tela cheia: use o Sleep Timer, ajuste a sincronia (-0.5s / +0.5s) ou toque em Traduzir nas letras.',
    spotlightLabel: 'Letras centralizadas & Tradução',
    position: 'center',
  },
  {
    title: 'Pastas e Capas',
    body: 'Toque na engrenagem (⚙) no topo para trocar/adicionar pastas monitoradas ou puxar capas e letras faltantes quando precisar.',
    spotlightLabel: 'Configurações > Pasta de Músicas',
    position: 'top',
  },
];

export const TourOverlay: React.FC = () => {
  const { isTourVisible, completeTour } = usePlayer();
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (isTourVisible) {
      setStepIdx(0);
    }
  }, [isTourVisible]);

  if (!isTourVisible) return null;

  const step = TOUR_STEPS[stepIdx];
  const isLast = stepIdx === TOUR_STEPS.length - 1;

  return (
    <Modal
      visible={isTourVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={completeTour}
    >
      <SafeAreaProvider>
        <SafeAreaView style={styles.backdrop} edges={['top', 'bottom']}>
          <View
            style={[
              styles.contentSlot,
              step.position === 'top' && styles.slotTop,
              step.position === 'center' && styles.slotCenter,
              step.position === 'bottom' && styles.slotBottom,
            ]}
          >
            {step.position === 'top' && (
              <View style={styles.spotlightPill}>
                <View style={styles.spotlightDot} />
                <Text style={styles.spotlightTitle}>Área em destaque</Text>
                <Text style={styles.spotlightSub}>{step.spotlightLabel}</Text>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <View style={styles.badge}>
                  <Sparkles color={COLORS.primary} size={13} />
                  <Text style={styles.badgeText}>
                    Tour • Passo {stepIdx + 1} de {TOUR_STEPS.length}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={completeTour}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Fechar tour"
                >
                  <X color={COLORS.textSecondary} size={19} />
                </TouchableOpacity>
              </View>

              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.body}>{step.body}</Text>

              <View style={styles.footer}>
                <View style={styles.dots}>
                  {TOUR_STEPS.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === stepIdx && styles.dotActive]}
                    />
                  ))}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity onPress={completeTour} style={styles.skipBtn}>
                    <Text style={styles.skipText}>Pular tour</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.nextBtn}
                    onPress={() => {
                      if (isLast) {
                        completeTour();
                      } else {
                        setStepIdx((prev) => prev + 1);
                      }
                    }}
                  >
                    <Text style={styles.nextText}>
                      {isLast ? 'Começar' : 'Próximo'}
                    </Text>
                    {!isLast && <ArrowRight color={COLORS.black} size={15} />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {step.position !== 'top' && (
              <View style={styles.spotlightPill}>
                <View style={styles.spotlightDot} />
                <Text style={styles.spotlightTitle}>Área em destaque</Text>
                <Text style={styles.spotlightSub}>{step.spotlightLabel}</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    paddingHorizontal: SPACING.md,
  },
  contentSlot: {
    flex: 1,
    gap: 14,
  },
  slotTop: {
    justifyContent: 'flex-start',
    paddingTop: 56,
  },
  slotCenter: {
    justifyContent: 'center',
  },
  slotBottom: {
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  spotlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20, 20, 24, 0.92)',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...SHADOWS.floating,
  },
  spotlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  spotlightTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  spotlightSub: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'right',
  },
  card: {
    backgroundColor: '#18181D',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.floating,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryDim,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  nextText: {
    color: COLORS.black,
    fontSize: 13,
    fontWeight: '800',
  },
});
