import { Joyride, STATUS, type EventData, type Step, type BeaconRenderProps } from "react-joyride";
import { useTour } from "../../lib/TourContext";
import { useCallback, useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";

type AppTourProps = {
  tourId: string;
  steps: Step[];
  run?: boolean;
  onComplete?: () => void;
  showHelpButton?: boolean;
};


function CustomBeacon(props: any) {
  const beaconProps = props.beaconProps;
  return (
    <div 
      {...beaconProps} 
      className="relative flex items-center justify-center cursor-pointer group pointer-events-auto"
    >
      <div className="absolute h-8 w-8 animate-ping rounded-full bg-brand/30" />
      <div className="relative animate-bounce-slow">
        <svg 
          width="32" 
          height="32" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="text-brand drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] rotate-[15deg] group-hover:rotate-0 transition-transform"
        >
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
          <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      </div>
    </div>
  );
}

export function AppTour({ tourId, steps, run = true, onComplete, showHelpButton = true }: AppTourProps) {
  const { isTourCompleted, completeTour, restartTour } = useTour();
  const [isMounted, setIsMounted] = useState(false);
  const shouldRun = run && !isTourCompleted(tourId);
  const [hasOpenModal, setHasOpenModal] = useState(false);
  const isTourActive = isMounted && shouldRun && !hasOpenModal;

  useEffect(() => {
    // Delay activation to prevent "flash" of tour tooltips during initial render/hydration
    const timer = setTimeout(() => setIsMounted(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const updateModalState = () => {
      setHasOpenModal(
        Boolean(document.querySelector('[role="dialog"][aria-modal="true"]')),
      );
    };

    updateModalState();

    const observer = new MutationObserver(updateModalState);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-app-tour-running", isTourActive);

    return () => {
      document.body.classList.remove("is-app-tour-running");
    };
  }, [isTourActive]);

  const handleJoyrideEvent = useCallback((data: EventData) => {
    const { status } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      completeTour(tourId);
      onComplete?.();
    }
  }, [completeTour, onComplete, tourId]);

  const brandColor = "#ef5d75";

  return (
    <>
      <Joyride
        {...{
          steps: steps,
          run: isTourActive,
          continuous: true,
          scrollToFirstStep: true,
          beaconComponent: CustomBeacon,
          onEvent: handleJoyrideEvent,
          locale: {
            back: "Voltar",
            close: "Fechar",
            last: "Finalizar",
            next: "Próximo",
            nextWithProgress: "Próximo ({current} de {total})",
            skip: "Pular tour",
          },
          options: {
            buttons: ["skip", "back", "close", "primary"],
            closeButtonAction: "skip",
            offset: 18,
            overlayClickAction: "close",
            scrollOffset: 112,
            showProgress: true,
            spotlightPadding: 12,
            width: "min(380px, calc(100vw - 32px))",
            zIndex: 9999,
          },
          floaterProps: {
            disableAnimation: true,
            options: {
              preventOverflow: {
                boundariesElement: 'viewport',
              },
            },
            styles: {
              floater: {
                filter: 'none'
              },
              container: {
                zIndex: 9999
              }
            }
          },
          styles: {
            options: {
              arrowColor: "rgb(var(--color-card))",
              backgroundColor: "rgb(var(--color-card))",
              overlayColor: "rgba(0, 0, 0, 0.75)",
              primaryColor: brandColor,
              textColor: "rgb(var(--color-foreground))",
              zIndex: 9999,
              beaconSize: 36,
            },
            beacon: {
                display: 'flex',
            },
            beaconInner: {
                backgroundColor: "rgb(var(--tour-beacon-color, 239 93 117))",
            },
            beaconOuter: {
                borderColor: "rgb(var(--tour-beacon-color, 239 93 117))",
                backgroundColor: "rgba(var(--tour-beacon-color, 239 93 117) / 0.2)",
            },
            tooltip: {
              borderRadius: "20px",
              padding: "clamp(14px, 4vw, 20px)",
              border: "1px solid rgba(var(--color-card-border) / 0.4)",
              backgroundColor: "rgba(var(--color-card) / 0.95)",
              backdropFilter: "blur(16px)",
              maxHeight: "calc(100vh - 128px)",
              overflowY: "auto",
            },
            tooltipContainer: {
              textAlign: "left",
            },
            tooltipTitle: {
              fontWeight: 900,
              fontSize: "clamp(16px, 4.2vw, 18px)",
              marginBottom: "10px",
              color: "rgb(var(--color-foreground))",
            },
            tooltipContent: {
              fontSize: "clamp(13px, 3.6vw, 14px)",
              fontWeight: 600,
              lineHeight: "1.6",
              color: "rgb(var(--color-muted-foreground))",
            },
            buttonNextWithProgress:{
              backgroundColor: "#ef5d75",
              borderRadius: "12px",
              color: "#fff",
              fontWeight: 900,
              fontSize: "14px",
              padding: "10px 20px",
              border: "none",
            },
            buttonNext: {
              backgroundColor: "#ef5d75",
              borderRadius: "12px",
              color: "#fff",
              fontWeight: 900,
              fontSize: "14px",
              padding: "10px 20px",
              border: "none",
            },
            buttonBack: {
              marginRight: "10px",
              color: "rgb(var(--color-muted-foreground))",
              fontWeight: 900,
              fontSize: "14px",
            },
            buttonSkip: {
              color: "rgb(var(--color-magenta))",
              fontWeight: 900,
              fontSize: "14px",
            },
          }
        } as any}
      />
      {showHelpButton && (
        <button
          onClick={() => restartTour(tourId)}
          className="fixed bottom-6 left-6 z-[40] hidden md:grid h-12 w-12 place-items-center rounded-2xl border border-card-border bg-card/80 text-muted-foreground shadow-lg backdrop-blur-md transition-all hover:scale-110 hover:border-brand/40 hover:bg-card hover:text-brand active:scale-95 sm:h-10 sm:w-10 sm:rounded-xl"
          title="Ver tutorial novamente"
        >
          <HelpCircle size={24} className="sm:size-5" />
        </button>
      )}

    </>
  );
}
