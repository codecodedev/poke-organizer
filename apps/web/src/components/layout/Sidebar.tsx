import { useState, type ReactNode } from "react";
import {
  FolderOpen,
  Home,
  LibraryBig,
  LogOut,
  Moon,
  ShoppingBag,
  ShoppingCart,
  MessageSquare,
  Swords,
  Sun,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  User as UserIcon,
  Gavel,
  Package,
  Layers3,
} from "lucide-react";
import { Button } from "../ui/Button";
import { NotificationBell } from "../ui/NotificationBell";
import type { Session } from "../../lib/api";

type View = "home" | "cards" | "collections" | "decks" | "buy" | "expansions" | "proposals" | "profile" | "my-auctions" | "orders" | "carts";

type NavItem = {
  id: View;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { id: "home", label: "Início", icon: <Home size={20} /> },
  { id: "buy", label: "Comprar", icon: <ShoppingBag size={20} /> },
  { id: "expansions", label: "Expansões", icon: <Layers3 size={20} /> },
  { id: "my-auctions", label: "Meus Leilões", icon: <Gavel size={20} /> },
  { id: "orders", label: "Pedidos", icon: <Package size={20} /> },
  { id: "cards", label: "Minhas Cartas", icon: <LibraryBig size={20} /> },
  { id: "collections", label: "Coleções", icon: <FolderOpen size={20} /> },
  // { id: "decks", label: "Decks", icon: <Swords size={20} /> },
  { id: "proposals", label: "Propostas", icon: <MessageSquare size={20} /> },
  { id: "profile", label: "Perfil", icon: <UserIcon size={20} /> },
];

type Props = {
  session: Session | null;
  activeView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
};

export function Sidebar({
  session,
  activeView,
  onNavigate,
  onLogout,
  theme,
  onToggleTheme,
  isOpen,
  onToggleOpen,
  onSession,
  onUnauthorized,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  const dark = theme === "dark";

  // Only allow hover to expand sidebar on desktop
  const effectiveOpen = isOpen || (isHovered && typeof window !== 'undefined' && window.innerWidth >= 768);

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onToggleOpen}
      />

      {/* Sidebar Container */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-card-border bg-card backdrop-blur-2xl transition-all duration-300 ease-in-out ${
          effectiveOpen 
            ? "w-[280px] translate-x-0" 
            : "w-[280px] -translate-x-full md:w-20 md:translate-x-0"
        }`}
      >
        {/* Header/Logo */}
        <div className="flex h-24 items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-3 min-w-0">
            <img 
              src={dark ? "/images/logo-light-bg.png" : "/images/logo-dark-bg.png"} 
              alt="Logo" 
              className="h-12 w-12 shrink-0 object-contain animate-soft-pop scale-[2.5]"
            />
            <div
              className={`min-w-0 transition-all duration-300 ${
                effectiveOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 md:hidden"
              }`}
            >
              <h1 className="truncate text-xl font-black text-foreground">
                coleciona<span className="gradient-text">.cards</span>
              </h1>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {session?.user.name || session?.user.email || "Visitante"}
              </p>
              {session?.user.profileSlug && effectiveOpen && (
                 <a 
                   href={`/public/profile/${session.user.profileSlug}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="mt-1 flex items-center gap-1 text-[9px] font-black text-brand uppercase hover:underline"
                 >
                   Ver Perfil Público <ExternalLink size={10} />
                 </a>
              )}
            </div>
          </div>
          
          {/* Close button for mobile */}
          {isOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-card-border bg-card text-foreground md:hidden"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {session ? (
            navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-bold transition-all duration-200 ${
                  activeView === item.id
                    ? "bg-gradient-to-r from-cyan to-magenta text-white shadow-lg"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground bg-slate-200/80 dark:bg-slate-800/80"
                }`}
                title={!effectiveOpen ? item.label : undefined}
              >
                <span className={`shrink-0 ${activeView === item.id ? "text-white dark:text-slate-900" : "text-muted-foreground"}`}>{item.icon}</span>
                <span
                  className={`truncate transition-opacity duration-200 ${activeView === item.id ? "text-white dark:text-slate-900" : "text-muted-foreground" } ${
                    effectiveOpen ? "opacity-100" : "opacity-0 md:hidden"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))
          ) : (
             <button
                type="button"
                className="btn-gradient w-full py-3 rounded-2xl"
                onClick={() => window.location.href = "/"}
              >
                {effectiveOpen ? "Entrar" : "In"}
              </button>
          )}
        {/* Footer Actions */}
        <div className="space-y-4 p-4 ">
          {session && (
            <div className={`flex items-center gap-3 ${!effectiveOpen && 'md:justify-center'} `}>
               <NotificationBell
                 session={session}
                 onSession={onSession}
                 onUnauthorized={onUnauthorized}
                 onNavigate={(link) => {
                   const url = new URL(link, window.location.origin);
                   const tab = url.searchParams.get("tab");
                   onNavigate("proposals");
                 }}
               />
                {effectiveOpen && <span className="text-sm font-bold text-muted-foreground">Notificações</span>}
            </div>
          )}

          {session && (
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-bold text-red-500 transition-all duration-200 hover:bg-red-500/10"
              title={!effectiveOpen ? "Sair" : undefined}
            >
              <LogOut size={20} />
              <span
                className={`truncate transition-opacity duration-200 ${
                  effectiveOpen ? "opacity-100" : "opacity-0 md:hidden"
                }`}
              >
                Sair
              </span>
            </button>
          )}
        </div>
        </nav>

        {/* Footer Actions */}
        <div className="space-y-4 p-4 ">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-bold text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
            title={!effectiveOpen ? (dark ? "Modo claro" : "Modo escuro") : undefined}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
            <span
              className={`truncate transition-opacity duration-200 ${
                effectiveOpen ? "opacity-100" : "opacity-0 md:hidden"
              }`}
            >
              {dark ? "Modo claro" : "Modo escuro"}
            </span>
          </button>
          
          {/* Desktop Toggle Button */}
          <button
            type="button"
            onClick={onToggleOpen}
            className="hidden h-10 w-full items-center justify-center rounded-xl border border-card-border bg-card/50 text-muted-foreground transition-colors hover:text-foreground md:flex"
          >
            {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

      </aside>
    </>
  );
}
