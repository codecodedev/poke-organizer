import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { FolderOpen, Home, LibraryBig, LogOut, Sparkles } from "lucide-react";
import { AudioRegistrationPanel } from "../components/AudioRegistrationPanel";
import { CardSearch } from "../components/CardSearch";
import { CollectionList } from "../components/CollectionList";
import { CollectionsPage } from "../components/collections/CollectionsPage";
import { api, type Session } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/session";
import { AuthPanel } from "../components/AuthPanel";
import { Button } from "../components/ui/Button";

type View = "home" | "cards" | "collections";
type AppRoute = {
  view: View;
  collection?: string | null;
  card?: string | null;
};

export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [refreshKey, setRefreshKey] = useState(0);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
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

  if (!session) {
    return <AuthPanel onSession={handleSession} />;
  }

  function navigate(nextRoute: AppRoute) {
    setRoute(nextRoute);
    window.history.pushState(null, "", routeToUrl(nextRoute));
  }

  function logout() {
    clearSession();
    setSession(null);
  }

  function refreshCollection() {
    setRefreshKey((value) => value + 1);
  }

  return (
    <main className="app-shell">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand via-coral to-amber font-black text-white shadow-glow">
              PO
            </div>
            <div>
              <h1 className="text-xl font-black text-ink">Poke Organizer</h1>
              <p className="text-sm font-medium text-slate-600">{session.user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NavButton active={view === "home"} icon={<Home size={16} />} onClick={() => navigate({ view: "home" })}>
              Inicio
            </NavButton>
            <NavButton active={view === "cards"} icon={<LibraryBig size={16} />} onClick={() => navigate({ view: "cards" })}>
              Cartas
            </NavButton>
            <NavButton active={view === "collections"} icon={<FolderOpen size={16} />} onClick={() => navigate({ view: "collections" })}>
              Colecoes
            </NavButton>
            <Button type="button" onClick={logout} icon={<LogOut size={16} />}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
        {view === "home" && (
          <>
            <HeroPanel session={session} onSession={handleSession} onUnauthorized={handleUnauthorized} onAdded={refreshCollection} />
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
            />
          </>
        )}

        {view === "cards" && (
          <>
            <HeroPanel session={session} onSession={handleSession} onUnauthorized={handleUnauthorized} onAdded={refreshCollection} compact />
            <CardSearch
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
            onCollectionRouteChange={(collection) => navigate({ view: "collections", collection })}
          />
        )}
      </div>
    </main>
  );
}

function NavButton({
  active,
  icon,
  children,
  onClick
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
      className={`btn ${active ? "bg-night text-white shadow-soft" : "border border-line bg-white/80 text-night shadow-sm hover:border-lilac/40"}`}
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
  compact = false
}: {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onAdded: () => void;
  compact?: boolean;
}) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-5">
        <div>
          <span className="chip mb-2">
            <Sparkles size={14} />
            Colecao viva
          </span>
          <h2 className={`${compact ? "max-w-xl text-2xl" : "max-w-2xl text-3xl sm:text-4xl"} font-black leading-tight text-ink`}>
            Organize cartas e acompanhe valores.
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Busque, cadastre por voz e separe seu inventario em colecoes.
          </p>
        </div>
        <AudioRegistrationPanel
          session={session}
          onSession={onSession}
          onUnauthorized={onUnauthorized}
          onAdded={onAdded}
        />
      </div>
      <div className="holo-strip animate-shimmer h-2" />
    </div>
  );
}

function parseRoute(): AppRoute {
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  const view: View = page === "cards" || page === "collections" ? page : "home";
  return {
    view,
    collection: view === "collections" ? params.get("collection") : null,
    card: params.get("card")
  };
}

function routeToUrl(route: AppRoute): string {
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
