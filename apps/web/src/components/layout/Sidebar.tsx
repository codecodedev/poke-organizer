import type { ReactNode } from "react";
import {
  FolderOpen,
  Home,
  LibraryBig,
  LogOut,
  Moon,
  ShoppingBag,
  Swords,
  Sun,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "../ui/Button";
import { NotificationBell } from "../ui/NotificationBell";
import type { Session } from "../../lib/api";

type View = "home" | "cards" | "collections" | "decks" | "profile";

type NavItem = {
  id: View;
  label: string;
  icon: ReactNode;
};

const navItems: NavItem[] = [
  { id: "home", label: "Início", icon: <Home size={20} /> },
  { id: "cards", label: "Cartas", icon: <LibraryBig size={20} /> },
  { id: "collections", label: "Coleções", icon: <FolderOpen size={20} /> },
  { id: "decks", label: "Decks", icon: <Swords size={20} /> },
  { id: "profile", label: "Propostas", icon: <ShoppingBag size={20} /> },
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
  const dark = theme === "dark";

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
        className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-white/70 bg-white/75 backdrop-blur-xl transition-all duration-300 ease-in-out dark:border-slate-800/50 dark:bg-slate-900/80 ${
          isOpen 
            ? "w-[280px] translate-x-0" 
            : "w-[280px] -translate-x-full md:w-20 md:translate-x-0"
        }`}
      >
        {/* Header/Logo */}
        <div className="flex h-20 items-center justify-between gap-3 px-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand via-coral to-amber font-black text-white shadow-glow">
              CC
            </div>
            <div
              className={`min-w-0 transition-all duration-300 ${
                isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 md:hidden"
              }`}
            >
              <h1 className="truncate text-xl font-black text-ink">
                Coleciona cards
              </h1>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {session?.user.email ?? "Visitante"}
              </p>
            </div>
          </div>
          
          {/* Close button for mobile */}
          {isOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white/80 text-night md:hidden"
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
                    ? "bg-night text-white shadow-soft dark:bg-brand dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
                title={!isOpen ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                <span
                  className={`truncate transition-opacity duration-200 ${
                    isOpen ? "opacity-100" : "opacity-0 md:hidden"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            ))
          ) : (
             <Button
                type="button"
                variant="brand"
                className="w-full"
                onClick={() => window.location.href = "/"}
              >
                {isOpen ? "Entrar" : "In"}
              </Button>
          )}
        </nav>

        {/* Footer Actions */}
        <div className="space-y-4 p-4">
          {session && (
            <div className={`flex items-center gap-3 ${!isOpen && 'md:justify-center'}`}>
               <NotificationBell
                  session={session}
                  onSession={onSession}
                  onUnauthorized={onUnauthorized}
                  onNavigate={(link) => {
                    const url = new URL(link, window.location.origin);
                    const tab = url.searchParams.get("tab");
                    onNavigate("profile");
                  }}
                />
                {isOpen && <span className="text-sm font-bold text-slate-500">Notificações</span>}
            </div>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-bold text-slate-600 transition-all duration-200 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            title={!isOpen ? (dark ? "Modo claro" : "Modo escuro") : undefined}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
            <span
              className={`truncate transition-opacity duration-200 ${
                isOpen ? "opacity-100" : "opacity-0 md:hidden"
              }`}
            >
              {dark ? "Modo claro" : "Modo escuro"}
            </span>
          </button>

          {session && (
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 font-bold text-red-500 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"
              title={!isOpen ? "Sair" : undefined}
            >
              <LogOut size={20} />
              <span
                className={`truncate transition-opacity duration-200 ${
                  isOpen ? "opacity-100" : "opacity-0 md:hidden"
                }`}
              >
                Sair
              </span>
            </button>
          )}

          {/* Desktop Toggle Button */}
          <button
            type="button"
            onClick={onToggleOpen}
            className="hidden h-10 w-full items-center justify-center rounded-xl border border-line bg-white/50 text-slate-400 transition-colors hover:text-night md:flex dark:border-slate-800 dark:bg-slate-800/50"
          >
            {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </aside>
    </>
  );
}
