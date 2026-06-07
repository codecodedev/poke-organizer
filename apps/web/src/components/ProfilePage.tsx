import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  ExternalLink, 
  Gavel, 
  ShoppingBag, 
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
            className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-white text-slate-700 transition hover:bg-field shadow-sm"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-ink">Minhas Propostas</h1>
            <p className="text-sm font-semibold text-slate-500">Gerencie suas propostas enviadas e acompanhe seus lances ativos.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          onClick={() => setTab("proposals")}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-black transition ${
            tab === "proposals"
              ? "border-brand/40 bg-brand/10 text-brand shadow-soft"
              : "border-line/80 bg-white/70 text-slate-500 hover:bg-white"
          }`}
        >
          <ShoppingBag size={20} />
          Propostas ({proposals.length})
        </button>
        <button
          onClick={() => setTab("bids")}
          className={`flex shrink-0 items-center gap-2 rounded-2xl border px-6 py-3 text-sm font-black transition ${
            tab === "bids"
              ? "border-amber-400/40 bg-amber-50 text-amber-700 shadow-soft"
              : "border-line/80 bg-white/70 text-slate-500 hover:bg-white"
          }`}
        >
          <Gavel size={20} />
          Meus Lances ({bids.length})
        </button>
      </div>

      <Panel className="p-0 overflow-hidden border-line/60">
        {loading ? (
          <div className="py-24 text-center font-black text-slate-400 animate-pulse">Carregando dados...</div>
        ) : (
          <div className="divide-y divide-line/40">
            {tab === "proposals" ? (
              <>
                {proposals.length === 0 ? (
                  <div className="py-24 text-center">
                    <p className="text-sm font-bold text-slate-400">Você ainda não fez nenhuma proposta em coleções.</p>
                  </div>
                ) : (
                  proposals.map((offer) => (
                    <div key={offer.id} className="p-6 transition hover:bg-field/30">
                      <div className="flex flex-wrap items-start justify-between gap-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Proposta</span>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              offer.status === "accepted" ? "bg-leaf text-white" :
                              offer.status === "rejected" ? "bg-red-500 text-white" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {offer.status === "accepted" ? "Aceita" : offer.status === "rejected" ? "Recusada" : "Pendente"}
                            </span>
                          </div>
                          <h3 className="mt-2 text-xl font-black text-ink">Valor sugerido: {formatBrl(offer.totalOffer)}</h3>
                          <p className="mt-1 text-sm font-semibold text-slate-500">Enviada em: {new Date(offer.createdAt).toLocaleDateString()}</p>
                          
                          <div className="mt-4 flex flex-wrap gap-2">
                            {offer.items.map((item) => (
                              <div key={item.id} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-600 border border-line/60 shadow-sm">
                                {item.quantity}x {item.item.card.name}
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="brand"
                          className="h-11 px-6 gap-2 text-sm"
                          onClick={() => window.location.href = `/?publicCollection=${offer.folderId}`}
                        >
                          <ExternalLink size={16} />
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
                  <div className="py-24 text-center">
                    <p className="text-sm font-bold text-slate-400">Você ainda não deu lances em nenhuma carta.</p>
                  </div>
                ) : (
                  bids.map((bid) => (
                    <div key={bid.id} className="p-6 transition hover:bg-field/30">
                      <div className="flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-600 shadow-sm border border-amber-100">
                            <Gavel size={28} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Lance Atual</p>
                            <h3 className="text-2xl font-black text-ink">{formatBrl(bid.amount)}</h3>
                            <p className="text-sm font-semibold text-slate-500">
                              Por {bid.quantity} unidade(s) • {new Date(bid.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="primary"
                          className="h-11 px-6 gap-2 text-sm bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300"
                          onClick={() => window.location.href = `/?publicCollection=${bid.folderId}`}
                        >
                          <ExternalLink size={16} />
                          Acompanhar Leilão
                        </Button>
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
