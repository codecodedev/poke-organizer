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
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const containerRef = useRef<HTMLDivElement>(null);

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
        <div className="absolute left-0 bottom-12 z-[100] w-[calc(100vw-2rem)] max-w-80 animate-soft-pop overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-card backdrop-blur-md md:left-full h-auto md:ml-4 md:bottom-0">
          <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
            <h2 className="text-sm font-black text-ink">Notificações</h2>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[400px] overflow-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-xs font-bold text-slate-400">Nenhuma notificação por aqui.</div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.link)}
                  className={`flex w-full flex-col gap-1 border-b border-line/40 px-5 py-4 text-left transition hover:bg-field/50 ${!n.isRead ? "bg-brand/5" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11px] font-black uppercase tracking-wider ${!n.isRead ? "text-brand" : "text-slate-400"}`}>
                      {n.title}
                    </span>
                    {!n.isRead && <div className="h-2 w-2 rounded-full bg-brand" />}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">{n.message}</p>
                  <span className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
