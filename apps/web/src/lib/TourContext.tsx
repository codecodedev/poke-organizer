import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type TourContextType = {
  isTourCompleted: (tourId: string) => boolean;
  completeTour: (tourId: string) => void;
  resetTours: () => void;
  restartTour: (tourId: string) => void;
};

const TourContext = createContext<TourContextType | undefined>(undefined);
const COMPLETED_TOURS_STORAGE_KEY = "poke_organizer_completed_tours";

function loadCompletedTours() {
  try {
    const saved = localStorage.getItem(COMPLETED_TOURS_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed)
      ? parsed.filter((tourId): tourId is string => typeof tourId === "string")
      : [];
  } catch (e) {
    console.error("Failed to load tours from localStorage", e);
    return [];
  }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [completedTours, setCompletedTours] =
    useState<string[]>(loadCompletedTours);

  const isTourCompleted = useCallback((tourId: string) => {
    return completedTours.includes(tourId);
  }, [completedTours]);

  const completeTour = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      if (prev.includes(tourId)) return prev;

      const next = [...prev, tourId];
      localStorage.setItem(COMPLETED_TOURS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetTours = useCallback(() => {
    setCompletedTours([]);
    localStorage.removeItem(COMPLETED_TOURS_STORAGE_KEY);
  }, []);

  const restartTour = useCallback((tourId: string) => {
    setCompletedTours((prev) => {
      const next = prev.filter((id) => id !== tourId);
      localStorage.setItem(COMPLETED_TOURS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isTourCompleted, completeTour, resetTours, restartTour }),
    [completeTour, isTourCompleted, resetTours, restartTour],
  );

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
