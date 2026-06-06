import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  Clock, 
  ExternalLink, 
  Gavel, 
  ShoppingBag, 
  Trophy, 
  User as UserIcon 
} from "lucide-react";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { formatBrl } from "../lib/format";
import type { CollectionCartOffer, CollectionItemBid } from "@poke-organizer/shared";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onBack: () => void;
  initialTab?: string | null;
};

export function ProfilePage({ session, onSession, onUnauthorized, onBack, initialTab }: Props) {
  const [tab, setTab] = useState<"proposals" | "bids">(initialTab === "bids" ? "bids" : "proposals");
  const [proposals, setProposals] = useState<CollectionCartOffer[]>([]);
  const [bids, setBids] = useState<CollectionItemBid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [nextProposals, nextBids] = await withAuthRetry(session, onSession, onUnauthorized, async (token) => {
          return Promise.all([
            api.listMyProposals(token),
            api.listMyBids(token),
          ]);
        });
        setProposals(nextProposals);
        setBids(nextBids);
      } catch (err) {
        console.error("Failed to load profile data", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session, onSession, onUnauthorized]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-ink">Meu Perfil</h1>
            <p className="text-sm font-semibold text-slate-500">Gerencie suas propostas e lances.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setTab("proposals")}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-black transition ${
            tab === "proposals"
              ? "border-brand/40 bg-brand/10 text-brand shadow-soft"
              : "border-line/80 bg-white/70 text-slate-500 hover:bg-white"
          }`}
        >
          <ShoppingBag size={18} />
          Minhas Propostas
        </button>
        <button
          onClick={() => setTab("bids")}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-black transition ${
            tab === "bids"
              ? "border-amber-400/40 bg-amber-50 text-amber-700 shadow-soft"
              : "border-line/80 bg-white/70 text-slate-500 hover:bg-white"
          }`}
        >
          <Gavel size={18} />
          Meus Lances
        </button>
      </div>

      <Panel>
        {loading ? (
          <div className="py-20 text-center font-black text-slate-400 animate-pulse">Carregando...</div>
        ) : (
          <div className="grid gap-4">
            {tab === "proposals" ? (
              <>
                {proposals.length === 0 ? (
                  <div className="py-20 text-center text-sm font-bold text-slate-400">
                    Você ainda não fez nenhuma proposta em coleções.
                  </div>
                ) : (
                  proposals.map((offer) => (
                    <div key={offer.id} className="rounded-2xl border border-line/70 bg-field/40 p-5 transition hover:border-line hover:bg-field/60">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-ink">Proposta na coleção</p>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              offer.status === "accepted" ? "bg-leaf/10 text-emerald-700 border border-leaf/20" :
                              offer.status === "rejected" ? "bg-red-50 text-red-700 border border-red-100" :
                              "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                              {offer.status === "accepted" ? "Aceita" : offer.status === "rejected" ? "Recusada" : "Pendente"}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-slate-600">Total: {formatBrl(offer.totalOffer)}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {offer.items.map((item) => (
                              <div key={item.id} className="rounded-lg bg-white/80 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-line/40">
                                {item.quantity}x {item.item.card.name}
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="brand"
                          className="h-9 gap-2 text-xs"
                          onClick={() => window.open(`/?publicCollection=${offer.folderId}`, "_blank")}
                        >
                          <ExternalLink size={14} />
                          Ver Coleção
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                {bids.length === 0 ? (
                  <div className="py-20 text-center text-sm font-bold text-slate-400">
                    Você ainda não deu lances em nenhuma carta.
                  </div>
                ) : (
                  bids.map((bid) => (
                    <div key={bid.id} className="rounded-2xl border border-line/70 bg-field/40 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 shadow-sm border border-amber-200">
                            <Gavel size={24} />
                          </div>
                          <div>
                            <p className="font-black text-ink">Lance de {formatBrl(bid.amount)}</p>
                            <p className="text-xs font-semibold text-slate-500">
                              Por {bid.quantity} carta(s) • {new Date(bid.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {/* More bid details or link could go here */}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
