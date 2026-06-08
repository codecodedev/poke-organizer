import { useEffect, useState } from "react";
import { Gavel, History, Timer, User, X } from "lucide-react";
import type { AuctionDetail } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";

type Props = {
  idOrToken: string;
  session: Session | null;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onSelectProfile: (slug: string) => void;
};

export function AuctionPage({ idOrToken, session, onSession, onUnauthorized, onSelectProfile }: Props) {
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getAuction(idOrToken, session?.accessToken);
        if (!cancelled) setAuction(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Leilão não encontrado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [idOrToken, session]);

  async function handleBid() {
    if (!session || !auction) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const updated = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.placeAuctionBid(token, auction.id, Number(bidAmount)),
      );
      setAuction(updated);
      setBidAmount("");
      setMessage({ type: "success", text: "Lance realizado com sucesso!" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao dar lance" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-10 text-center font-bold text-slate-500">Carregando leilão...</div>;
  if (error || !auction) return <div className="p-10 text-center font-bold text-red-500">{error || "Leilão não encontrado"}</div>;

  const isOwner = session?.user.id === auction.sellerId;
  const isOpen = auction.status === "open" && new Date(auction.endsAt) > new Date();
  const minNextBid = auction.currentBid ? auction.currentBid + 0.01 : auction.minBid;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6 min-w-0">
        <Panel className="dark:bg-black/20 dark:border-white/5">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="relative w-full sm:w-48 aspect-[3/4] overflow-hidden rounded-[24px] bg-field shadow-lg dark:bg-white/5">
              {auction.card.imageLarge && (
                <img src={auction.card.imageLarge} className="h-full w-full object-contain" alt="" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                 <span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 uppercase tracking-wider flex items-center gap-1 dark:bg-amber-400/20 dark:text-amber-400">
                   <Gavel size={12} /> Leilão
                 </span>
                 <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                   isOpen ? "bg-leaf/10 text-leaf dark:bg-leaf/20" : "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"
                 }`}>
                   {isOpen ? "Ativo" : "Encerrado"}
                 </span>
              </div>
              <h1 className="text-3xl font-black text-ink leading-tight dark:text-white">{auction.card.name}</h1>
              <p className="text-lg font-bold text-slate-500">{auction.card.rarity} • {auction.card.setName}</p>
              
              <div className="mt-8 flex items-center gap-3">
                <button 
                  onClick={() => onSelectProfile(auction.sellerSlug || auction.sellerId)}
                  className="group flex items-center gap-3 rounded-2xl border border-line bg-white dark:bg-zinc-900 p-2 pr-5 transition hover:border-brand dark:hover:border-brand shadow-sm hover:shadow-md dark:border-white/10"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white keep-white font-black text-sm dark:bg-white dark:text-ink group-hover:bg-brand group-hover:text-white dark:group-hover:bg-brand dark:group-hover:text-white transition-colors">
                    {auction.sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-brand transition-colors">Vendedor</p>
                    <p className="text-sm font-black text-ink dark:text-white">{auction.sellerName}</p>
                  </div>
                </button>
              </div>

              {auction.description && (
                <div className="mt-10">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Descrição do Lote</h3>
                  </div>
                  <div className="relative">
                    <p className="text-sm font-medium text-slate-700 bg-slate-50 dark:bg-white/5 p-5 rounded-2xl italic leading-relaxed dark:text-slate-300 border border-slate-100 dark:border-white/5">
                      "{auction.description}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel className="dark:bg-black/20 dark:border-white/5">
          <div className="flex items-center gap-3 mb-6">
            <History size={20} className="text-slate-400" />
            <h2 className="text-lg font-black text-ink dark:text-white">Histórico de Lances</h2>
          </div>
          
          <div className="space-y-3">
            {auction.bids.length === 0 ? (
              <div className="py-12 text-center rounded-3xl border-2 border-dashed border-line/50 dark:border-white/5">
                 <p className="text-sm font-bold text-slate-400">Nenhum lance ainda. Seja o primeiro!</p>
              </div>
            ) : (
              auction.bids.map((bid, index) => (
                <div key={bid.id} className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${
                  index === 0 
                    ? "border-amber-400 bg-amber-50 shadow-md ring-1 ring-amber-400/20 dark:bg-amber-400/10 dark:ring-amber-400/40" 
                    : "border-line/70 bg-white dark:bg-black/20 dark:border-white/5"
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`grid h-10 w-10 place-items-center rounded-xl font-black text-sm ${
                      index === 0 ? "bg-amber-400 text-white" : "bg-field text-slate-500 dark:bg-white/5 dark:text-slate-400"
                    }`}>
                      {auction.bids.length - index}
                    </div>
                    <div>
                      <p className="font-black text-ink dark:text-white">{bid.bidderName}</p>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                        {new Date(bid.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${index === 0 ? "text-amber-700 dark:text-amber-400" : "text-ink dark:text-white"}`}>
                      {formatBrl(bid.amount)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <aside className="space-y-6">
        <div className="lg:sticky lg:top-24 space-y-6">
          <Panel className="bg-ink text-white dark:bg-zinc-900 border-none shadow-2xl dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2 text-slate-300 dark:text-white/60">
                 <Timer size={18} className="text-amber-400" />
                 <span className="text-xs font-black uppercase tracking-widest">
                   {isOpen ? "Tempo Restante" : "Finalizado em"}
                 </span>
               </div>
               {!isOpen && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase keep-white">FIM</span>}
            </div>

            <div className="mb-8 p-6 rounded-[24px] bg-white/10 dark:bg-white/5 border border-white/10">
               <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-slate-400 dark:text-white/40">
                 {auction.currentBid ? "Lance Atual" : "Lance Inicial"}
               </p>
               <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-amber-400">
                    {formatBrl(auction.currentBid ?? auction.minBid)}
                 </span>
               </div>
               <p className="text-xs font-bold text-slate-300 dark:text-white/40 mt-3">
                 Total de <span className="text-white dark:text-white/90 keep-white">{auction.bidCount}</span> lances
               </p>
            </div>

            {isOpen ? (
              <div className="space-y-4">
                {isOwner ? (
                  <div className="rounded-2xl bg-white/10 dark:bg-white/5 p-4 border border-white/10">
                    <p className="text-xs font-bold text-slate-200 dark:text-white/70 text-center">
                      Você é o dono deste leilão.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-300 dark:text-white/50 px-1">Seu Lance (Min {formatBrl(minNextBid)})</label>
                       <div className="relative">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-white/40 text-lg">R$</span>
                         <input 
                           className="w-full h-14 rounded-2xl bg-white/10 dark:bg-white/5 border-white/20 dark:border-white/10 focus:border-amber-400 focus:ring-amber-400/20 text-white font-black text-xl pl-12 outline-none transition-all keep-white"
                           type="number"
                           step="0.01"
                           min={minNextBid}
                           value={bidAmount}
                           onChange={(e) => setBidAmount(e.target.value)}
                           placeholder={minNextBid.toFixed(2)}
                         />
                       </div>
                    </div>

                    {message && (
                      <div className={`rounded-xl p-3 text-xs font-bold ${
                        message.type === "success" ? "bg-leaf/20 text-leaf-light" : "bg-red-500/20 text-red-200"
                      }`}>
                        {message.text}
                      </div>
                    )}

                    <Button
                      variant="brand"
                      className="w-full h-14 text-base shadow-glow shadow-amber-500/20 bg-amber-400 text-ink hover:bg-amber-300 border-none"
                      disabled={submitting || !bidAmount || Number(bidAmount) < minNextBid}
                      onClick={handleBid}
                    >
                      {submitting ? "Processando..." : "Confirmar Lance"}
                    </Button>
                    
                    {!session && (
                      <p className="text-[10px] font-bold text-slate-400 dark:text-white/40 text-center">
                        Você precisa estar logado para dar lances.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 p-6 border border-white/10 text-center">
                 <p className="text-sm font-black text-white keep-white">Este leilão foi encerrado.</p>
                 <p className="text-xs font-medium text-slate-400 dark:text-white/40 mt-1">
                   {auction.currentBid ? "Vendido pelo maior lance." : "Encerrado sem lances."}
                 </p>
              </div>
            )}
          </Panel>

          <Panel className="bg-field/30 dark:bg-black/20 dark:border-white/5">
             <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4 px-1">Informações</h3>
             <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Iniciado em</span>
                 <span className="text-xs font-black text-ink dark:text-white">{new Date(auction.createdAt).toLocaleDateString()}</span>
               </div>
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Encerra em</span>
                 <span className="text-xs font-black text-ink dark:text-white">{new Date(auction.endsAt).toLocaleDateString()}</span>
               </div>
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ID</span>
                 <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">{auction.id.slice(0, 12)}</span>
               </div>
             </div>
          </Panel>
        </div>
      </aside>
    </div>
  );
}
