import { useEffect, useState } from "react";
import { Gavel, History, Timer, ChevronRight, Search, Plus } from "lucide-react";
import type { AuctionSummary } from "@poke-organizer/shared";
import { api, type Session, type AppRoute } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { AuctionWizardModal } from "./AuctionWizardModal";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onSelectAuction: (id: string) => void;
  onNavigate: (route: AppRoute) => void;
};

export function MyAuctionsPage({ session, onSession, onUnauthorized, onSelectAuction, onNavigate }: Props) {
  const [auctions, setAuctions] = useState<AuctionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [showWizard, setShowWizard] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.listMyAuctions(token),
      );
      setAuctions(data);
    } catch (err) {
      console.error("Failed to load auctions", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session]);

  const filteredAuctions = auctions.filter(a => {
    if (filter === "open") return a.status === "open";
    if (filter === "closed") return a.status === "closed";
    return true;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink dark:text-white">Meus Leilões</h1>
          <p className="text-slate-500 font-medium">Gerencie suas vendas por leilão</p>
        </div>
        <Button variant="brand" icon={<Plus size={18} />} onClick={() => setShowWizard(true)}>
          Novo Leilão
        </Button>
      </header>

      <Panel className="p-2 sm:p-2 bg-slate-100/50 dark:bg-white/5">
        <div className="flex p-1 gap-1">
          {(["all", "open", "closed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition-all ${
                filter === f
                  ? "bg-white text-brand shadow-sm dark:bg-slate-400 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {f === "all" ? "Todos" : f === "open" ? "Ativos" : "Finalizados"}
            </button>
          ))}
        </div>
      </Panel>

      {loading ? (
        <div className="py-20 text-center font-bold text-slate-500">Carregando seus leilões...</div>
      ) : filteredAuctions.length === 0 ? (
        <div className="py-20 text-center rounded-[32px] border-2 border-dashed border-line dark:border-white/5">
          <Gavel size={40} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold">Nenhum leilão encontrado nesta categoria.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAuctions.map((auction) => {
            const isOpen = auction.status === "open" && new Date(auction.endsAt) > new Date();
            return (
              <button
                key={auction.id}
                onClick={() => onSelectAuction(auction.shareToken)}
                className="group flex flex-col sm:flex-row sm:items-center gap-4 rounded-[24px] border border-line bg-white p-4 text-left transition hover:border-brand hover:shadow-md dark:border-white/5 dark:bg-black/20 dark:hover:border-brand/40"
              >
                <div className="flex flex-1 items-center gap-4 w-full sm:w-auto">
                  <div className="h-20 w-16 overflow-hidden rounded-xl bg-slate-50 dark:bg-white/5 shrink-0">
                    <img src={auction.card.imageSmall || ""} className="h-full w-full object-cover transition group-hover:scale-110" alt="" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {isOpen ? "Ativo" : "Encerrado"}
                      </span>
                    </div>
                    <h3 className="truncate font-black text-ink dark:text-white group-hover:text-brand transition-colors">{auction.card.name}</h3>
                    <div className="mt-2 flex items-center gap-4 text-[10px] sm:text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-1">
                        <Gavel size={12} className="text-slate-400" />
                        {auction.bidCount} lances
                      </div>
                      <div className="flex items-center gap-1">
                        <Timer size={12} className="text-slate-400" />
                        {new Date(auction.endsAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 sm:px-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-line/40 dark:border-white/5">
                  <div className="sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Lance Atual</p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {formatBrl(auction.currentBid ?? auction.minBid)}
                    </p>
                  </div>

                  <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-50 group-hover:bg-brand/10 transition dark:bg-white/5">
                    <ChevronRight size={20} className="text-slate-400 group-hover:text-brand" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showWizard && (
        <AuctionWizardModal
          session={session}
          onSession={onSession}
          onUnauthorized={onUnauthorized}
          onClose={() => setShowWizard(false)}
          onCreated={(shareToken) => {
            setShowWizard(false);
            void load();
            window.open(`/auctions/${shareToken}`, "_blank");
          }}
        />
      )}
    </div>
  );
}
