import { useEffect, useState, useRef } from "react";
import { Bell, Check, X } from "lucide-react";
import { api, type Session } from "../../lib/api";
import { withAuthRetry } from "../../lib/authRetry";

type Notification = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onNavigate: (link: string) => void;
};

export function NotificationBell({ session, onSession, onUnauthorized, onNavigate }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  async function load() {
    try {
      const list = await withAuthRetry(session, onSession, onUnauthorized, (token) => 
        api.listNotifications(token)
      );
      setNotifications(list);
    } catch (err) {
      console.error("Failed to load notifications", err);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function markAsRead(id: string, link?: string | null) {
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) => 
        api.markNotificationAsRead(token, id)
      );
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      if (link) {
        onNavigate(link);
        setOpen(false);
      }
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  }

  return (
    <div className="z-20" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative grid h-10 w-10 place-items-center rounded-xl border transition ${
          open ? "border-brand/50 bg-brand/10 text-brand shadow-soft" : "border-line bg-white text-slate-700 hover:bg-field"
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-sm ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Overlay para mobile para bloquear o fundo */}
          {isMobile && (
            <div 
              className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
              onClick={() => setOpen(false)}
            />
          )}
          
          <div className={`${
            isMobile 
              ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] w-[calc(100vw-32px)] max-h-[80vh] animate-soft-pop flex flex-col" 
              : "absolute left-0 bottom-12 z-[100] w-[calc(100vw-2rem)] max-w-80 animate-soft-pop overflow-hidden md:left-full md:ml-4 md:bottom-0"
            } rounded-[26px] border border-white/80 bg-white shadow-card backdrop-blur-md overflow-hidden`}>
            
            <div className="flex shrink-0 items-center justify-between border-b border-line/70 px-6 py-5">
              <h2 className="text-base font-black text-ink">Notificações</h2>
              <button 
                onClick={() => setOpen(false)} 
                className="grid h-8 w-8 place-items-center rounded-full bg-field text-slate-400 transition hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className={`overflow-y-auto flex-1 min-h-0 ${isMobile ? "" : "max-h-[400px]"}`}>
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-sm font-bold text-slate-400">Nenhuma notificação por aqui.</div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => markAsRead(n.id, n.link)}
                    className={`flex w-full flex-col gap-1.5 border-b border-line/40 px-6 py-5 text-left transition hover:bg-field/50 ${!n.isRead ? "bg-brand/5" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-xs font-black uppercase tracking-wider ${!n.isRead ? "text-brand" : "text-slate-400"}`}>
                        {n.title}
                      </span>
                      {!n.isRead && <div className="h-2.5 w-2.5 rounded-full bg-brand" />}
                    </div>
                    <p className="text-sm font-semibold text-slate-600 leading-relaxed">{n.message}</p>
                    <span className="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
