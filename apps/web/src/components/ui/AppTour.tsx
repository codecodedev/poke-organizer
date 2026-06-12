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
  autoStart?: boolean;
};


function CustomBeacon(props: any) {
  const beaconProps = props.beaconProps;
  return (
    <div 
      {...beaconProps} 
      className="relative flex items-center justify-center cursor-pointer group pointer-events-auto"
    >
      <div className="absolute h-10 w-10 animate-ping rounded-full bg-brand/30" />
      <div className="relative animate-wobble">
        <svg 
          width="38" 
          height="38" 
          viewBox="-64 0 512 512" 
          fill="currentColor"
          className="text-brand drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M135.652 0c23.625 0 43.826 20.65 43.826 44.8v99.851c17.048-16.34 49.766-18.346 70.944 6.299 22.829-14.288 53.017-2.147 62.315 16.45C361.878 158.426 384 189.346 384 240c0 2.746-.203 13.276-.195 16 .168 61.971-31.065 76.894-38.315 123.731C343.683 391.404 333.599 400 321.786 400H150.261l-.001-.002c-18.366-.011-35.889-10.607-43.845-28.464C93.421 342.648 57.377 276.122 29.092 264 10.897 256.203.008 242.616 0 224c-.014-34.222 35.098-57.752 66.908-44.119 8.359 3.583 16.67 8.312 24.918 14.153V44.8c0-23.45 20.543-44.8 43.826-44.8zM136 416h192c13.255 0 24 10.745 24 24v48c0 13.255-10.745 24-24 24H136c-13.255 0-24-10.745-24-24v-48c0-13.255 10.745-24 24-24zm168 28c-11.046 0-20 8.954-20 20s8.954 20 20 20 20-8.954 20-20-8.954-20-20-20z"/>
        </svg>
      </div>
    </div>
  );
}

export function AppTour({ tourId, steps, run = true, onComplete, showHelpButton = true, autoStart = false }: AppTourProps) {
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

  // Conditionally skip beacons for individual steps
  const finalSteps = autoStart ? steps.map(step => ({
    ...step,
    skipBeacon: true, // v3 uses skipBeacon instead of disableBeacon
  })) : steps;

  return (
    <>
      <Joyride
        {...{
          steps: finalSteps,
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
