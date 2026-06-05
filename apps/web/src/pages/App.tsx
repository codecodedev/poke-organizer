import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  FolderOpen,
  Home,
  LibraryBig,
  LogOut,
  Menu,
  Moon,
  Sparkles,
  Swords,
  Sun,
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

type View = "home" | "cards" | "collections" | "decks";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  if (route.publicCollection) {
    return (
      <>
        <RequestFeedback />
        <div className="fixed right-4 top-4 z-40">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <PublicCollectionPage shareToken={route.publicCollection} />
      </>
    );
  }

  if (!session) {
    return (
      <>
        <RequestFeedback />
        <div className="fixed right-4 top-4 z-40">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        <AuthPanel onSession={handleSession} />
      </>
    );
  }

  function navigate(nextRoute: AppRoute) {
    setRoute(nextRoute);
    setMobileMenuOpen(false);
    window.history.pushState(null, "", routeToUrl(nextRoute));
  }

  function logout() {
    clearSession();
    setSession(null);
    setMobileMenuOpen(false);
  }

  function refreshCollection() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <>
      <RequestFeedback />
      <main className="app-shell">
        <header className="sticky top-0 z-30 border-b border-white/70 bg-white/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand via-coral to-amber font-black text-white shadow-glow">
                CC
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-xl font-black text-ink">
                  Coleciona cards
                </h1>
                <p className="truncate text-sm font-medium text-slate-600">
                  {session.user.email}
                </p>
              </div>
            </div>

            <div className="hidden flex-wrap items-center gap-2 md:flex">
              <NavButton
                active={view === "home"}
                icon={<Home size={16} />}
                onClick={() => navigate({ view: "home" })}
              >
                Inicio
              </NavButton>

              <NavButton
                active={view === "cards"}
                icon={<LibraryBig size={16} />}
                onClick={() => navigate({ view: "cards" })}
              >
                Cartas
              </NavButton>

              <NavButton
                active={view === "collections"}
                icon={<FolderOpen size={16} />}
                onClick={() => navigate({ view: "collections" })}
              >
                Colecoes
              </NavButton>

              <NavButton
                active={view === "decks"}
                icon={<Swords size={16} />}
                onClick={() => navigate({ view: "decks" })}
              >
                Decks
              </NavButton>

              <Button
                type="button"
                onClick={logout}
                icon={<LogOut size={16} />}
              >
                Sair
              </Button>

              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-white/80 text-night shadow-sm md:hidden"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/40"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            />

            <aside className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-white p-5 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <strong className="text-lg text-ink">Menu</strong>
                  <p className="text-xs font-medium text-slate-500">
                    {session.user.email}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-night"
                  aria-label="Fechar menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <NavButton
                  active={view === "home"}
                  icon={<Home size={16} />}
                  onClick={() => navigate({ view: "home" })}
                >
                  Inicio
                </NavButton>

                <NavButton
                  active={view === "cards"}
                  icon={<LibraryBig size={16} />}
                  onClick={() => navigate({ view: "cards" })}
                >
                  Cartas
                </NavButton>

                <NavButton
                  active={view === "collections"}
                  icon={<FolderOpen size={16} />}
                  onClick={() => navigate({ view: "collections" })}
                >
                  Colecoes
                </NavButton>

                <NavButton
                  active={view === "decks"}
                  icon={<Swords size={16} />}
                  onClick={() => navigate({ view: "decks" })}
                >
                  Decks
                </NavButton>

                <Button
                  type="button"
                  onClick={logout}
                  icon={<LogOut size={16} />}
                >
                  Sair
                </Button>

                <ThemeToggle theme={theme} onToggle={toggleTheme} />
              </div>
            </aside>
          </div>
        )}

        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
          {view === "home" && (
            <>
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
            </>
          )}

          {view === "cards" && (
            <>
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
            </>
          )}

          {view === "collections" && (
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

          {view === "decks" && (
            <DecksPage
              session={session}
              onSession={handleSession}
              onUnauthorized={handleUnauthorized}
            />
          )}
        </div>
      </main>
      <SpeedInsights />
    </>
  );
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: ThemeMode;
  onToggle: () => void;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className="btn border border-line bg-white/80 text-night shadow-sm hover:border-lilac/40"
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{dark ? "Claro" : "Escuro"}</span>
    </button>
  );
}

function NavButton({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn ${
        active
          ? "bg-night text-white shadow-soft"
          : "border border-line bg-white/80 text-night shadow-sm hover:border-lilac/40"
      }`}
    >
      {icon}
      {children}
    </button>
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
    page === "cards" || page === "collections" || page === "decks"
      ? page
      : "home";

  return {
    view,
    publicCollection: null,
    collection: view === "collections" ? params.get("collection") : null,
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

  if (route.view === "collections" && route.collection) {
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
