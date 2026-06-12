// Main application component
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronRight,
  Eye,
  Flame,
  FolderOpen,
  Gavel,
  Home,
  Layers3,
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
  HelpCircle,
} from "lucide-react";
import { AudioRegistrationPanel } from "../components/AudioRegistrationPanel";
import { CardSearch } from "../components/CardSearch";
import { CollectionList } from "../components/CollectionList";
import { CollectionsPage } from "../components/collections/CollectionsPage";
import { DecksPage } from "../components/decks/DecksPage";
import { PublicCollectionPage } from "../components/collections/PublicCollectionPage";
import { PublicProfilePage } from "../components/PublicProfilePage";
import { AuctionPage } from "../components/AuctionPage";
import { ExpansionsPage } from "../components/ExpansionsPage";
import { ExpansionDetailPage } from "../components/ExpansionDetailPage";
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
import { BuyPage } from "../components/BuyPage";
import { OrdersPage } from "../components/OrdersPage";
import { MyAuctionsPage } from "../components/MyAuctionsPage";
import { Sidebar } from "../components/layout/Sidebar";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { FloatingCartButton } from "../components/ui/FloatingCartButton";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { RequestPasswordResetPanel } from "../components/RequestPasswordResetPanel";
import { ResetPasswordPanel } from "../components/ResetPasswordPanel";
import { ConfirmEmailPanel } from "../components/ConfirmEmailPanel";
import { CartAreaPage } from "../components/CartAreaPage";
import { TourProvider, useTour } from "../lib/TourContext";
import { LegalPage } from "../components/LegalPage";

type View = "home" | "cards" | "collections" | "decks" | "buy" | "expansions" | "expansion-detail" | "proposals" | "profile" | "my-auctions" | "orders" | "request-password-reset" | "reset-password" | "confirm-email" | "carts" | "terms" | "privacy";
type ThemeMode = "light" | "dark";
export type AppRoute = {
  view: View;
  publicCollection?: string | null;
  publicProfile?: string | null;
  auction?: string | null;
  collection?: string | null;
  card?: string | null;
  order?: string | null;
  token?: string | null;
  setId?: string | null;
  returnTo?: string | null;
  q?: string | null;
};

export function App() {
  return (
    <TourProvider>
      <AppContent />
    </TourProvider>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [refreshKey, setRefreshKey] = useState(0);
  const [route, setRoute] = useState<AppRoute>(() => parseRoute());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [blockedNavigationAt, setBlockedNavigationAt] = useState(0);

  const { restartTour } = useTour();
  const view = route.view;

  const currentTourId = useMemo(() => {
    if (route.publicCollection) return `public_collection_${route.publicCollection}`;
    if (view === "collections") {
      const params = new URLSearchParams(window.location.search);
      const collectionId = params.get("collection");
      if (collectionId === "new") return "collections_create";
      if (collectionId) return "collections_detail_v2";
      return "collections_list";
    }
    return null;
  }, [route.publicCollection, view, window.location.search]);

  // Navigation Guard for Browser navigation (tab close, external link)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

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
        
        // Handle external-like redirect
        if (redirect.includes("/public/") || redirect.includes("/auctions/") || redirect.startsWith("/p/")) {
          window.location.href = redirect;
        } else {
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
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.localStorage.setItem("poke-organizer-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function navigate(nextRoute: AppRoute) {
    if (hasUnsavedChanges && !window.confirm("Você tem alterações não salvas. Deseja mesmo sair sem salvar?")) {
      setBlockedNavigationAt(Date.now());
      return;
    }
    
    // Safety check for undefined routes
    if (nextRoute.auction === "undefined" || nextRoute.publicCollection === "undefined") {
       console.error("Navigation error: route parameter is undefined", nextRoute);
       return;
    }

    setHasUnsavedChanges(false);
    setRoute(nextRoute);
    setSidebarOpen(false);
    window.history.pushState(null, "", routeToUrl(nextRoute));
  }

  function logout() {
    clearSession();
    
    // Limpar carrinhos do localStorage para evitar conflitos entre usuarios
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("cart_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    setSession(null);
    setSidebarOpen(false);
    setShowLogoutConfirm(false);
  }

  function refreshCollection() {
    setRefreshKey((value) => value + 1);
  }

  const isPublicView = route.publicCollection || route.publicProfile || route.auction || view === "terms" || view === "privacy";

  return (
    <>
      <RequestFeedback />
      <div className="flex min-h-screen transition-all duration-300">
        {session && (
          <Sidebar
            session={session}
            activeView={view as any}
            onNavigate={(nextView) => navigate({ view: nextView })}
            onLogout={() => setShowLogoutConfirm(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            isOpen={sidebarOpen}
            onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
            onSession={handleSession}
            onUnauthorized={handleUnauthorized}
          />
        )}

        <div className={`flex flex-1 flex-col transition-all duration-300 ${session ? (sidebarOpen ? "md:ml-[280px]" : "md:ml-20") : ""}`}>
          {(session || isPublicView) && (
            <header className={`sticky top-0 z-20 flex h-20 items-center justify-between jus border-b border-white/5 bg-white/5 px-5 backdrop-blur-xl dark:bg-black/20 ${session ? 'md:hidden' : ''}`}>
              {/* Left: Sidebar Toggle (Mobile only) */}
              <div className={`flex items-center justify-start gap-2 ${session ? 'md:hidden' : ''}`}>
                {session && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/80 dark:bg-night text-night dark:text-white shadow-sm"
                  >
                    <Menu size={22} />
                  </button>
                )}
                {session && currentTourId && (
                  <button
                    type="button"
                    onClick={() => restartTour(currentTourId)}
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/80 dark:bg-night text-muted-foreground shadow-sm active:scale-95 transition-transform"
                    title="Ver tutorial novamente"
                  >
                    <HelpCircle size={22} />
                  </button>
                )}
              </div>

              <div className={`flex items-center justify-end gap-2 ${session ? 'hidden' : ''}`}>
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
                {currentTourId && (
                  <button
                    type="button"
                    onClick={() => restartTour(currentTourId)}
                    className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/80 dark:bg-night text-muted-foreground shadow-sm active:scale-95 transition-transform"
                    title="Ver tutorial novamente"
                  >
                    <HelpCircle size={22} />
                  </button>
                )}
              </div>

              {/* Center: Logo */}
              <div className="flex flex-1 items-center justify-center gap-2 sm:gap-3">
                <img 
                  src={theme === "dark" ? "/images/logo-light-bg.png" : "/images/logo-dark-bg.png"} 
                  alt="Logo" 
                  className="h-8 w-8 sm:h-10 sm:w-10 object-contain scale-[2.5]"
                />
                <span className="text-lg hidden sm:flex sm:text-xl font-black text-ink dark:text-white">coleciona<span className="gradient-text">.cards</span></span>
              </div>

              <div className={`flex items-center justify-end gap-3 ${session ? '' : 'hidden'}`}>
                <FloatingCartButton 
                  onClick={() => navigate({ view: "carts" })} 
                  className="md:hidden h-10 w-10 scale-90"
                  currentCollectionToken={route.publicCollection || undefined}
                />
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
              </div>

              {/* Right: Actions */}
              <div className="flex items-center justify-end">
                {!session && (
                  <Button
                    variant="brand"
                    className="h-9 px-4 text-xs sm:h-11 sm:px-5 sm:text-sm"
                    onClick={() => {
                       const returnTo = window.location.pathname + window.location.search;
                       navigate({ view: "home", returnTo });
                    }}
                  >
                    Entrar
                  </Button>
                )}
              </div>
            </header>
          )}

          <main className={`mx-auto w-full max-w-7xl gap-5 px-5 py-6 ${!session && !isPublicView ? 'flex flex-1 flex-col items-center justify-center' : ''}`}>
            {!session && !isPublicView && view !== "request-password-reset" && view !== "reset-password" && view !== "confirm-email" && (
              <AuthPanel 
                onSession={handleSession} 
                theme={theme} 
                onRequestPasswordReset={() => navigate({ view: "request-password-reset" })}
              />
            )}

            {view === "terms" && (
              <LegalPage type="terms" onBack={() => navigate({ view: "home" })} />
            )}

            {view === "privacy" && (
              <LegalPage type="privacy" onBack={() => navigate({ view: "home" })} />
            )}

            {view === "request-password-reset" && (
              <RequestPasswordResetPanel 
                onBack={() => navigate({ view: "home" })} 
                theme={theme} 
              />
            )}

            {view === "reset-password" && (
              <ResetPasswordPanel 
                token={route.token || ""} 
                onSuccess={() => navigate({ view: "home" })} 
                theme={theme} 
              />
            )}

            {view === "confirm-email" && (
              <ConfirmEmailPanel 
                token={route.token || ""} 
                onComplete={() => navigate({ view: "home" })} 
              />
            )}

            {route.publicCollection && (
              <PublicCollectionPage
                shareToken={route.publicCollection}
                initialQuery={route.q || ""}
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onNavigate={navigate}
                theme={theme}
                onToggleTheme={toggleTheme}
                hideHeader
              />
            )}

            {route.publicProfile && (
              <PublicProfilePage
                slug={route.publicProfile}
                session={session}
                onSelectCollection={(shareToken) => navigate({ view: "home", publicCollection: shareToken })}
                onSelectAuction={(id) => navigate({ view: "home", auction: id })}
              />
            )}

            {route.auction && (
              <AuctionPage
                shareToken={route.auction}
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onSelectProfile={(slug) => navigate({ view: "home", publicProfile: slug })}
                onNavigate={navigate}
              />
            )}

            {!isPublicView && view === "home" && session && (
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

            {!isPublicView && view === "cards" && session && (
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
                  onNavigate={navigate}
                  refreshKey={refreshKey}
                  title="Todas as cartas"
                  description="Inventario geral das cartas que voce possui."
                  modalItemId={route.card ?? null}
                  onModalItemChange={(card) => navigate({ view: "cards", card })}
                />
              </div>
            )}

            {!isPublicView && view === "collections" && session && (
              <CollectionsPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                collectionRoute={route.collection ?? null}
                onCollectionRouteChange={(collection) =>
                  navigate({ view: "collections", collection })
                }
                onUnsavedChanges={setHasUnsavedChanges}
                blockedNavigationAt={blockedNavigationAt}
              />
            )}

            {!isPublicView && view === "decks" && session && (
              <DecksPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
              />
            )}

            {!isPublicView && view === "buy" && session && (
              <BuyPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onNavigate={(route) => navigate(route)}
              />
            )}

            {!isPublicView && view === "expansions" && session && (
              <ExpansionsPage
                session={session}
                onSelectSet={(id) => navigate({ view: "expansion-detail", setId: id })}
              />
            )}

            {!isPublicView && view === "expansion-detail" && session && route.setId && (
              <ExpansionDetailPage
                setId={route.setId}
                session={session}
                onBack={() => navigate({ view: "expansions" })}
              />
            )}

            {!isPublicView && view === "my-auctions" && session && (
              <MyAuctionsPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onSelectAuction={(id) => navigate({ view: "home", auction: id })}
                onNavigate={navigate}
              />
            )}

            {!isPublicView && view === "proposals" && session && (
              <ProfilePage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onBack={() => navigate({ view: "home" })}
                initialTab="proposals"
                onUnsavedChanges={setHasUnsavedChanges}
                blockedNavigationAt={blockedNavigationAt}
              />
            )}

            {!isPublicView && view === "profile" && session && (
              <ProfilePage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onBack={() => navigate({ view: "home" })}
                initialTab="settings"
                onUnsavedChanges={setHasUnsavedChanges}
                blockedNavigationAt={blockedNavigationAt}
              />
            )}

            {!isPublicView && view === "orders" && session && (
              <OrdersPage
                session={session}
                onSession={handleSession}
                onUnauthorized={handleUnauthorized}
                onBack={() => navigate({ view: "home" })}
                initialOrderId={route.order ?? null}
                onOrderRouteChange={(orderId) => navigate({ view: "orders", order: orderId })}
              />
            )}

            {!isPublicView && view === "carts" && session && (
              <CartAreaPage
                onNavigate={navigate}
              />
            )}
          </main>
      </div>
      {showLogoutConfirm && (
        <ConfirmationModal
          title="Sair da conta"
          description="Você tem certeza que deseja sair da sua conta?"
          confirmLabel="Sair agora"
          cancelLabel="Continuar logado"
          onConfirm={logout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
          {session && (
            <FloatingCartButton 
              onClick={() => navigate({ view: "carts" })} 
              className="fixed bottom-6 right-8 z-[100] hidden md:flex left-auto"
              currentCollectionToken={route.publicCollection || undefined}
            />
          )}
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
            className="w-full text-white dark:text-slate-900"
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
  const path = window.location.pathname;
  const search = new URLSearchParams(window.location.search);
  
  // Aliases para links curtos e profissionais
  const shortPublicCollectionMatch = path.match(/^\/p\/([^/]+)\/?$/);
  if (shortPublicCollectionMatch) {
    return { view: "home", publicCollection: decodeURIComponent(shortPublicCollectionMatch[1]) };
  }

  const publicCollectionMatch = path.match(/^\/public\/collections\/([^/]+)\/?$/);
  if (publicCollectionMatch) {
    return { view: "home", publicCollection: decodeURIComponent(publicCollectionMatch[1]) };
  }

  const publicProfileMatch = path.match(/^\/public\/profile\/([^/]+)\/?$/);
  if (publicProfileMatch) {
    return { view: "home", publicProfile: decodeURIComponent(publicProfileMatch[1]) };
  }

  const auctionMatch = path.match(/^\/auctions\/([^/]+)\/?$/);
  if (auctionMatch) {
    return { view: "home", auction: decodeURIComponent(auctionMatch[1]) };
  }

  if (path === "/confirm-email") {
    return { view: "confirm-email", token: search.get("token") };
  }
  if (path === "/reset-password") {
    return { view: "reset-password", token: search.get("token") };
  }
  if (path === "/terms") {
    return { view: "terms" };
  }
  if (path === "/privacy") {
    return { view: "privacy" };
  }

  const params = new URLSearchParams(window.location.search);
  const page = params.get("page");
  const view: View =
    (page === "cards" || page === "collections" || page === "decks" || page === "buy" || page === "expansions" || page === "expansion-detail" || page === "proposals" || page === "profile" || page === "my-auctions" || page === "orders" || page === "request-password-reset" || page === "carts" || page === "terms" || page === "privacy")
      ? page as View
      : (path.slice(1) || "home") as View;

  return {
    view,
    publicCollection: null,
    publicProfile: null,
    auction: null,
    collection: (view === "collections" || view === "profile" || view === "proposals" || view === "carts") ? params.get("collection") : null,
    card: params.get("card"),
    order: view === "orders" ? params.get("order") : null,
    token: search.get("token"),
    setId: params.get("setId"),
    returnTo: search.get("returnTo"),
    q: params.get("q"),
  };
}

function routeToUrl(route: AppRoute): string {
  if (route.publicCollection) {
    const url = `/p/${encodeURIComponent(route.publicCollection)}`;
    if (route.q) return `${url}?q=${encodeURIComponent(route.q)}`;
    return url;
  }
  if (route.publicProfile) {
    return `/public/profile/${encodeURIComponent(route.publicProfile)}`;
  }
  if (route.auction) {
    return `/auctions/${encodeURIComponent(route.auction)}`;
  }
  if (route.view === "confirm-email") {
    return `/confirm-email${route.token ? `?token=${encodeURIComponent(route.token)}` : ""}`;
  }
  if (route.view === "reset-password") {
    return `/reset-password${route.token ? `?token=${encodeURIComponent(route.token)}` : ""}`;
  }
  if (route.view === "terms") {
    return "/terms";
  }
  if (route.view === "privacy") {
    return "/privacy";
  }

  const params = new URLSearchParams();

  if (route.view !== "home") {
    params.set("page", route.view);
  }

  if ((route.view === "collections" || route.view === "profile" || route.view === "proposals" || route.view === "carts") && route.collection) {
    params.set("collection", route.collection);
  }

  if (route.view === "expansion-detail" && route.setId) {
    params.set("setId", route.setId);
  }

  if (route.card) {
    params.set("card", route.card);
  }

  if (route.view === "orders" && route.order) {
    params.set("order", route.order);
  }

  if (route.q) {
    params.set("q", route.q);
  }

  if (route.returnTo) {
    params.set("redirect", route.returnTo);
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
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [summaryData, auctionsData] = await Promise.all([
          api.getHomeSummary(session.accessToken),
          api.listActiveAuctions()
        ]);
        setSummary(summaryData);
        setAuctions(auctionsData);
      } catch (err) {
        if (err instanceof HttpError && err.status === 401) {
          const next = await onUnauthorized();
          if (next) {
            const [summaryData, auctionsData] = await Promise.all([
              api.getHomeSummary(next.accessToken),
              api.listActiveAuctions()
            ]);
            setSummary(summaryData);
            setAuctions(auctionsData);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session.accessToken, onUnauthorized, refreshKey]);

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Cadastrar cartas */}
      <HeroPanel
        navigate={navigate}
        session={session}
        onSession={onSession}
        onUnauthorized={onUnauthorized}
        onAdded={onAdded}
      />

      <div className="grid pb-16 gap-6 lg:grid-cols-2">

        {/* Coleções em alta */}
        <div className="glass-panel overflow-hidden p-5">
          <div className="mb-5 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-magenta/10 text-magenta">
              <TrendingUp size={18} />
            </div>
            <h3 className="font-bold text-ink dark:text-white">Coleções em alta</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            {summary?.ranking?.map((folder, index) => (
              <button
                key={folder.id}
                onClick={() => navigate({ view: "home", publicCollection: folder.shareToken })}
                className="group flex flex-col gap-2 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-slate-200 dark:bg-white/5 text-[10px] font-black text-slate-500 group-hover:bg-cyan group-hover:text-white dark:group-hover:text-black transition-colors">
                    #{index + 1}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-ink dark:text-white text-sm group-hover:text-cyan transition-colors">
                        {folder.name}
                      </p>
                      {folder.isStore ? (
                        <span className="shrink-0 flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                          <ShoppingBag size={10} />
                        </span>
                      ) : (
                        <span className="shrink-0 flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          <LibraryBig size={10} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1 font-black text-slate-400 uppercase tracking-tighter">
                        {folder.userName || "Usuário"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} /> {folder.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <LibraryBig size={12} /> {folder.itemCount} cartas
                      </span>
                    </div>
                  </div>
                </div>
                <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan to-magenta" 
                    style={{ width: `${Math.min(100, (folder.viewCount / (summary?.ranking?.[0]?.viewCount || 1)) * 100)}%` }} 
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Expanções */}
        {summary?.expansionProgress && summary.expansionProgress.length > 0 && (
          <div className="glass-panel overflow-hidden p-5">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500">
                  <Layers3 size={18} />
                </div>
                <h3 className="font-bold text-ink dark:text-white">Expansões</h3>
              </div>
              <button 
                onClick={() => navigate({ view: "expansions" })}
                className="text-[10px] font-black uppercase tracking-widest text-brand hover:underline flex items-center gap-1"
              >
                Ver Todos <ChevronRight size={12} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {summary.expansionProgress.map((set) => (
                <button
                  key={set.id}
                  onClick={() => navigate({ view: "expansion-detail", setId: set.id })}
                  className="group flex flex-col gap-2 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-200 dark:bg-white/5 p-1 flex items-center justify-center">
                      {set.logoUrl ? (
                        <img src={set.logoUrl} className="max-h-full max-w-full object-contain" alt="" />
                      ) : (
                        <div className="text-[10px] font-black text-slate-400 uppercase">{set.id}</div>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-bold text-ink dark:text-white text-sm group-hover:text-indigo-400 transition-colors">
                          {set.name}
                        </p>
                        <span className="shrink-0 text-[10px] font-black text-slate-500">
                          {set.owned}/{set.total}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/5">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-1000" 
                          style={{ width: `${set.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Leilões em destaque */}
        <div className="glass-panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-orange-500/10 text-orange-500">
                <Flame size={18} />
              </div>
              <div>
                <h3 className="font-bold text-ink dark:text-white text-lg">Leilões em destaque</h3>
                <p className="text-xs text-slate-400">Participe dos leilões ativos da comunidade.</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : !auctions?.length ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/5">
              <Gavel size={32} className="mx-auto text-slate-600 mb-3" />
              <p className="text-slate-400 text-sm font-medium italic">Nenhum leilão ativo no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {auctions.map((auction) => (
                <div
                  key={auction.id}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/5 bg-white/5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-amber-500/10 hover:border-amber-500/30"
                  onClick={() => navigate({ view: "home", auction: auction.shareToken })}
                >
                  <div className="aspect-[3/4] overflow-hidden bg-white/5">
                    <img
                      src={auction.card.imageSmall || ""}
                      alt={auction.card.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-xs font-bold text-white">{auction.card.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] font-black text-amber-400">
                        {formatBrl(auction.currentBid || auction.minBid)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                        <Gavel size={10} /> {auction.bidCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suas propostas */}
        <div className="glass-panel p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-magenta/10 text-magenta">
              <ShoppingBag size={18} />
            </div>
            <h3 className="font-bold text-ink dark:text-white">Suas propostas</h3>
          </div>
          {!summary?.recentProposals?.length && !loading ? (
            <p className="py-4 text-center text-slate-400 text-sm italic">Nenhuma proposta enviada ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {summary?.recentProposals?.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Proposta em {offer.folderName || 'Loja'}</p>
                    <p className="font-bold text-white">{formatBrl(offer.totalOffer)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold uppercase ${offer.status === 'accepted' ? 'text-emerald-400' : offer.status === 'rejected' ? 'text-rose-400' : 'text-amber'}`}>
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
  );
}
