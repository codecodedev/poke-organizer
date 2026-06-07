import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  FolderOpen,
  Home,
  LibraryBig,
  LogOut,
  Menu,
  Moon,
  ShoppingBag,
  Sparkles,
  Swords,
  Sun,
  User as UserIcon,
  X,
} from "lucide-react";
import { AudioRegistrationPanel } from "../components/AudioRegistrationPanel";
import { CardSearch } from "../components/CardSearch";
import { CollectionList } from "../components/CollectionList";
import { CollectionsPage } from "../components/collections/CollectionsPage";
import { DecksPage } from "../components/decks/DecksPage";
import { PublicCollectionPage } from "../components/collections/PublicCollectionPage";
import { api, type Session } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/session";
import { AuthPanel } from "../components/AuthPanel";
import { Button } from "../components/ui/Button";
import { RequestFeedback } from "../components/ui/RequestFeedback";
import { SpeedInsights } from "@vercel/speed-insights/react";

import { NotificationBell } from "../components/ui/NotificationBell";
import { ProfilePage } from "../components/ProfilePage";
import { Sidebar } from "../components/layout/Sidebar";
import { ThemeToggle } from "../components/ui/ThemeToggle";

type View = "home" | "cards" | "collections" | "decks" | "profile";
type ThemeMode = "light" | "dark";
type AppRoute = {
  view: View;
  publicCollection?: string | null;
  collection?: string | null;
  card?: string | null;
};

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [refreshKey, setRefreshKey] = useState(0);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());

  const view = route.view;

  const handleSession = useCallback((nextSession: Session) => {
    saveSession(nextSession);
    setSession(nextSession);
  }, []);

  const handleUnauthorized = useCallback(async () => {
    if (!session?.refreshToken) {
      clearSession();
      setSession(null);
      return null;
    }

    try {
      const nextSession = await api.refresh(session.refreshToken);
      handleSession(nextSession);
      return nextSession;
    } catch {
      clearSession();
      setSession(null);
      return null;
    }
  }, [handleSession, session?.refreshToken]);

  useEffect(() => {
    if (session) {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect) {
        // Clear the redirect param from current URL to avoid loops
        params.delete("redirect");
        const newSearch = params.toString();
        const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}`;
        window.history.replaceState(null, "", newUrl);
        
        // Handle external-like redirect (to public collection paths) or internal views
        if (redirect.includes("/public/collections/")) {
          window.location.href = redirect;
        } else {
          // Attempt to parse internal redirect if possible, otherwise just stay at home
          setRoute(parseRoute());
        }
      }
    }
  }, [session]);

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("poke-organizer-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  if (route.publicCollection && !session) {
    return (
      <>
        <RequestFeedback />
        <PublicCollectionPage
          shareToken={route.publicCollection}
          session={session}
          onSession={handleSession}
          onUnauthorized={handleUnauthorized}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      </>
    );
  }

  function navigate(nextRoute: AppRoute) {
    setRoute(nextRoute);
    setSidebarOpen(false);
    window.history.pushState(null, "", routeToUrl(nextRoute));
  }

  function logout() {
    clearSession();
    setSession(null);
    setSidebarOpen(false);
  }

  function refreshCollection() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <>
      <RequestFeedback />
      <div className="flex min-h-screen transition-all duration-300">
        <Sidebar
          session={session}
          activeView={view}
          onNavigate={(nextView) => navigate({ view: nextView })}
          onLogout={logout}
          theme={theme}
          onToggleTheme={toggleTheme}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
          onSession={handleSession}
          onUnauthorized={handleUnauthorized}
        />

        <div className={`flex flex-1 flex-col transition-all duration-300 ${sidebarOpen ? "md:ml-[280px]" : "md:ml-20"}`}>
          <header className="sticky top-0 z-30 flex h-16 items-center border-b border-white/70 bg-white/75 px-5 backdrop-blur-xl md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/80 text-night shadow-sm"
            >
              <Menu size={22} />
            </button>
            <div className="ml-4 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand via-coral to-amber font-black text-white text-[10px]">
                CC
              </div>
              <span className="font-black text-ink">Coleciona cards</span>
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl gap-5 px-5 py-6">
            {route.publicCollection && (
              <PublicCollectionPage
                shareToken={route.publicCollection}
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                hideHeader
              />
            )}

            {!session && !route.publicCollection && (
              <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
                <div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-brand via-coral to-amber font-black text-white text-3xl shadow-glow mb-6">
                  CC
                </div>
                <h2 className="text-3xl font-black text-ink mb-2">Bem-vindo ao Coleciona cards</h2>
                <p className="text-slate-500 max-w-md mb-8">
                  Organize sua coleção de Pokémon TCG, acompanhe preços do mercado brasileiro e crie decks incríveis.
                </p>
                <AuthPanel
                  onSession={handleSession}
                />
              </div>
            )}

            {!route.publicCollection && view === "home" && session && (
              <div className="flex flex-col gap-4">
                <HeroPanel
                  navigate={navigate}
                  session={session}
                  onSession={handleSession}
                  onUnauthorized={handleUnauthorized}
                  onAdded={refreshCollection}
                />

                <CollectionList
                  session={session}
                  onSession={handleSession}
                  onUnauthorized={handleUnauthorized}
                  refreshKey={refreshKey}
                  limit={10}
                  title="Ultimas adicionadas"
                  description="As 10 cartas mais recentes do seu inventario."
                  modalItemId={route.card ?? null}
                  onModalItemChange={(card) => navigate({ view: "home", card })}
                  showCounts={false}
                />
              </div>
            )}

            {!route.publicCollection && view === "cards" && session && (
              <div className="flex flex-col gap-4">
                <HeroPanel
                  session={session}
                  onSession={handleSession}
                  onUnauthorized={handleUnauthorized}
                  onAdded={refreshCollection}
                  compact
                />

                <CardSearch
                  title="Cadastro manual"
                  session={session}
                  onSession={handleSession}
                  onUnauthorized={handleUnauthorized}
                  onAdded={refreshCollection}
                />

                <CollectionList
                  session={session}
                  onSession={handleSession}
                  onUnauthorized={handleUnauthorized}
                  refreshKey={refreshKey}
                  title="Todas as cartas"
                  description="Inventario geral das cartas que voce possui."
                  modalItemId={route.card ?? null}
                  onModalItemChange={(card) => navigate({ view: "cards", card })}
                />
              </div>
            )}

            {!route.publicCollection && view === "collections" && session && (
              <CollectionsPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                collectionRoute={route.collection ?? null}
                onCollectionRouteChange={(collection) =>
                  navigate({ view: "collections", collection })
                }
              />
            )}

            {view === "decks" && session && (
              <DecksPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
              />
            )}

            {view === "profile" && session && (
              <ProfilePage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onBack={() => navigate({ view: "home" })}
                initialTab={route.collection}
              />
            )}
          </main>
      </div>
    </div>
      <SpeedInsights />
    </>
  );
}

function HeroPanel({
  session,
  onSession,
  onUnauthorized,
  onAdded,
  compact = false,
  navigate,
}: {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onAdded: () => void;
  compact?: boolean;
  navigate?: (route: AppRoute) => void;
}) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5">
        {navigate ? (
          <Button
            type="button"
            variant="brand"
            icon={<Sparkles size={18} />}
            className="w-full"
            onClick={() => navigate({ view: "cards" })}
          >
            Cadastrar cartas
          </Button>
        ) : (
          <AudioRegistrationPanel
            session={session}
            onSession={onSession}
            onUnauthorized={onUnauthorized}
            onAdded={onAdded}
          />
        )}
      </div>

      <div className="holo-strip animate-shimmer h-2" />
    </div>
  );
}

function parseRoute(): AppRoute {
  const publicCollectionMatch = window.location.pathname.match(
    /^\/public\/collections\/([^/]+)\/?$/,
  );
  if (publicCollectionMatch) {
    return {
      view: "home",
      publicCollection: decodeURIComponent(publicCollectionMatch[1]),
      collection: null,
      card: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  const view: View =
    page === "cards" || page === "collections" || page === "decks" || page === "profile"
      ? page
      : "home";

  return {
    view,
    publicCollection: null,
    collection: (view === "collections" || view === "profile") ? params.get("collection") : null,
    card: params.get("card"),
  };
}

function routeToUrl(route: AppRoute): string {
  if (route.publicCollection) {
    return `/public/collections/${encodeURIComponent(route.publicCollection)}`;
  }

  const params = new URLSearchParams();

  if (route.view !== "home") {
    params.set("page", route.view);
  }

  if ((route.view === "collections" || route.view === "profile") && route.collection) {
    params.set("collection", route.collection);
  }

  if (route.card) {
    params.set("card", route.card);
  }

  const query = params.toString();

  return query ? `/?${query}` : "/";
}

function loadTheme(): ThemeMode {
  const stored = window.localStorage.getItem("poke-organizer-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}
