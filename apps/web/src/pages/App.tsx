import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Eye,
  FolderOpen,
  Gavel,
  Home,
  LibraryBig,
  LogOut,
  Menu,
  Moon,
  ShoppingBag,
  Sparkles,
  Swords,
  Sun,
  TrendingUp,
  User as UserIcon,
  X,
} from "lucide-react";
import { AudioRegistrationPanel } from "../components/AudioRegistrationPanel";
import { CardSearch } from "../components/CardSearch";
import { CollectionList } from "../components/CollectionList";
import { CollectionsPage } from "../components/collections/CollectionsPage";
import { DecksPage } from "../components/decks/DecksPage";
import { PublicCollectionPage } from "../components/collections/PublicCollectionPage";
import { api, HttpError, type Session } from "../lib/api";
import { clearSession, loadSession, saveSession } from "../lib/session";
import { AuthPanel } from "../components/AuthPanel";
import { Button } from "../components/ui/Button";
import { RequestFeedback } from "../components/ui/RequestFeedback";
import { SpeedInsights } from "@vercel/speed-insights/react";
import type { HomeSummary } from "@poke-organizer/shared";
import { formatBrl } from "../lib/format";

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
              <HomeView
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                navigate={navigate}
                refreshKey={refreshKey}
                onAdded={refreshCollection}
                cardRoute={route.card ?? null}
              />
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

function HomeView({
  session,
  onSession,
  onUnauthorized,
  navigate,
  refreshKey,
  onAdded,
  cardRoute,
}: {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  navigate: (route: AppRoute) => void;
  refreshKey: number;
  onAdded: () => void;
  cardRoute: string | null;
}) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getHomeSummary(session.accessToken);
        setSummary(data);
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          const next = await onUnauthorized();
          if (next) {
            const data = await api.getHomeSummary(next.accessToken);
            setSummary(data);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session.accessToken, onUnauthorized, refreshKey]);

  return (
    <div className="flex flex-col gap-6">
      <HeroPanel
        navigate={navigate}
        session={session}
        onSession={onSession}
        onUnauthorized={onUnauthorized}
        onAdded={onAdded}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <CollectionList
            session={session}
            onSession={onSession}
            onUnauthorized={onUnauthorized}
            refreshKey={refreshKey}
            limit={5}
            title="Ultimas adicionadas"
            description="As cartas mais recentes do seu inventario."
            modalItemId={cardRoute}
            onModalItemChange={(card) => navigate({ view: "home", card })}
            showCounts={false}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass-panel p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber/10 text-amber">
                  <Gavel size={18} />
                </div>
                <h3 className="font-bold text-ink">Seus lances recentes</h3>
              </div>
              {!summary?.recentBids.length && !loading ? (
                <p className="py-4 text-center text-slate-400 text-sm italic">Nenhum lance realizado ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {summary?.recentBids.map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between rounded-xl border border-line bg-white/50 p-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lance em {bid.folderId}</p>
                        <p className="font-bold text-ink">{formatBrl(bid.amount)}</p>
                      </div>
                      <span className="text-[10px] text-slate-400">{new Date(bid.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel p-5">
              <div className="mb-4 flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
                  <ShoppingBag size={18} />
                </div>
                <h3 className="font-bold text-ink">Suas propostas</h3>
              </div>
              {!summary?.recentProposals.length && !loading ? (
                <p className="py-4 text-center text-slate-400 text-sm italic">Nenhuma proposta enviada ainda.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {summary?.recentProposals.map((offer) => (
                    <div key={offer.id} className="flex items-center justify-between rounded-xl border border-line bg-white/50 p-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Proposta para {offer.buyerName}</p>
                        <p className="font-bold text-ink">{formatBrl(offer.totalOffer)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold uppercase ${offer.status === 'accepted' ? 'text-emerald-500' : offer.status === 'rejected' ? 'text-rose-500' : 'text-amber-500'}`}>
                          {offer.status === 'accepted' ? 'Aceita' : offer.status === 'rejected' ? 'Recusada' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass-panel overflow-hidden p-5">
            <div className="mb-5 flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-coral/10 text-coral">
                <TrendingUp size={18} />
              </div>
              <h3 className="font-bold text-ink">Coleções em alta</h3>
            </div>
            
            <div className="flex flex-col gap-4">
              {summary?.ranking.map((folder, index) => (
                <button
                  key={folder.id}
                  onClick={() => navigate({ view: "home", publicCollection: folder.shareToken })}
                  className="group flex flex-col gap-2 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[10px] font-black text-slate-400 group-hover:bg-brand group-hover:text-white transition-colors">
                      #{index + 1}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate font-bold text-ink text-sm group-hover:text-brand transition-colors">
                        {folder.name}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Eye size={12} /> {folder.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <LibraryBig size={12} /> {folder.itemCount} cartas
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-brand to-coral" 
                      style={{ width: `${Math.min(100, (folder.viewCount / (summary.ranking[0]?.viewCount || 1)) * 100)}%` }} 
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
