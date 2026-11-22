import React, { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

interface TourStep {
  title: string;
  description: string;
  targetLabel: string;
  position: 'top' | 'middle' | 'bottom';
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Sua Biblioteca e Fila',
    description:
      'Filtre por Todas, Favoritas ou Offline, ou toque nos 3 pontinhos (⋮) de qualquer música para Tocar a seguir ou Adicionar à fila.',
    targetLabel: 'Filtros rápidos & menu da faixa',
    position: 'top',
  },
  {
    title: 'Controle rápido e abas',
    description:
      'Alterne entre Biblioteca, Playlists e Explorar na barra inferior, ou use o MiniPlayer fixo para controlar e abrir o player completo.',
    targetLabel: 'Player ativo & Navegação',
    position: 'bottom',
  },
  {
    title: 'Player, Letras e Tradução',
    description:
      'Toque no MiniPlayer para abrir em tela cheia: use o Sleep Timer, ajuste a sincronia (-0.5s / +0.5s) ou toque em Traduzir nas letras.',
    targetLabel: 'Letras centralizadas & Tradução',
    position: 'middle',
  },
  {
    title: 'Pastas, Arquivos e Capas',
    description:
      'Toque na engrenagem (⚙) no topo para importar novas pastas/arquivos ou puxar capas e letras faltantes quando precisar.',
    targetLabel: 'Configurações > Importar & Capas',
    position: 'top',
  },
];

export const TourOverlay: React.FC = () => {
  const { isTourVisible, completeTour } = usePlayer();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (isTourVisible) {
      setStepIndex(0);
    }
  }, [isTourVisible]);

  if (!isTourVisible) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      completeTour();
    } else {
      setStepIndex((prev) => prev + 1);
    }
  };

  const spotlightEl = (
    <div className="tour-spotlight">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="tour-spot-dot" />
        <span className="tour-spot-label">Área em destaque</span>
      </div>
      <span className="tour-spot-target">{step.targetLabel}</span>
    </div>
  );

  return (
    <div className="tour-backdrop" role="dialog" aria-label="Tour do Aplicativo">
      <div className={`tour-container tour-${step.position}`}>
        {step.position === 'top' && spotlightEl}

        <div className="tour-card">
          <div className="tour-card-top">
            <span className="tour-step-pill">
              <Sparkles size={13} />
              Tour • Passo {stepIndex + 1} de {TOUR_STEPS.length}
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={completeTour}
              aria-label="Fechar tour"
            >
              <X size={18} />
            </button>
          </div>

          <h3 className="tour-title">{step.title}</h3>
          <p className="tour-desc">{step.description}</p>

          <div className="tour-footer">
            <div className="tour-dots">
              {TOUR_STEPS.map((_, idx) => (
                <span
                  key={idx}
                  className={`tour-dot ${idx === stepIndex ? 'active' : ''}`}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" className="tour-skip-btn" onClick={completeTour}>
                Pular tour
              </button>
              <button type="button" className="tour-next-btn" onClick={handleNext}>
                <span>{isLast ? 'Começar' : 'Próximo'}</span>
                {!isLast && <ArrowRight size={15} />}
              </button>
            </div>
          </div>
        </div>

        {(step.position === 'bottom' || step.position === 'middle') && spotlightEl}
      </div>
    </div>
  );
};
