import { useCallback, useEffect, useState, useMemo } from "react";
import { 
  Clock, 
  Gavel, 
  History, 
  TrendingUp, 
  User as UserIcon,
  Timer,
  AlertCircle,
  Copy,
  Check,
  ChevronRight
} from "lucide-react";
import { api, apiFeedback, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import type { AuctionDetail } from "@poke-organizer/shared";
import type { AppRoute } from "../pages/App";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { LoadingScreen } from "./ui/LoadingScreen";
import { SEO } from "./SEO";

type Props = {
  shareToken: string;
  session: Session | null;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onSelectProfile: (slug: string) => void;
  onNavigate: (route: AppRoute) => void;
};

export function AuctionPage({ shareToken, session, onSession, onUnauthorized, onSelectProfile, onNavigate }: Props) {
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.getAuctionDetail(shareToken, session?.accessToken);
      setAuction(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Leilão não encontrado");
    } finally {
      setLoading(false);
    }
  }, [shareToken, session]);

  useEffect(() => {
    void load();
    // Auto refresh every 30 seconds if open
    const interval = setInterval(() => {
      if (auction?.status === "open") void load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load, auction?.status]);

  useEffect(() => {
    if (!auction) return;
    
    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(auction.endsAt);
      const diff = end.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft("Encerrado");
        clearInterval(timer);
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) setTimeLeft(`${days}d ${hours}h`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m`);
      else setTimeLeft(`${mins}m ${secs}s`);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [auction]);

  async function handleBid(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    
    setSubmitting(true);
    setMessage(null);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.placeBid(token, shareToken, Number(bidAmount))
      );
      setMessage({ type: "success", text: "Lance realizado com sucesso!" });
      setBidAmount("");
      void load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao realizar lance" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    if (!session) return;
    setSubmitting(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.closeAuction(token, shareToken)
      );
      void load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao encerrar leilão" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSelectWinner(bidId: string) {
    if (!session) return;
    setSubmitting(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.selectAuctionWinner(token, shareToken, bidId)
      );
      void load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao selecionar vencedor" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBid(bidId: string) {
    if (!session) return;
    setSubmitting(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.deleteBid(token, shareToken, bidId)
      );
      void load();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao remover lance" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen message="Carregando leilão..." />;
  if (error || !auction) return <div className="p-10 text-center font-bold text-magenta">{error || "Leilão não encontrado"}</div>;

  const isOwner = session?.user.id === auction.sellerId;
  const isOpen = auction.status === "open" && new Date(auction.endsAt) > new Date();
  const minNextBid = auction.currentBid ? auction.currentBid + 0.01 : auction.minBid;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {auction && (
        <SEO 
          title={`Leilão: ${auction.card.name}`} 
          description={`Participe do leilão de ${auction.card.name} (${auction.card.rarity}) de ${auction.sellerName} no Coleciona cards. Lance atual: ${formatBrl(auction.currentBid ?? auction.minBid)}.`}
          image={auction.card.imageLarge || undefined}
          url={`/auctions/${shareToken}`}
        />
      )}
      <div className="space-y-6 min-w-0">
        <Panel>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="relative w-full sm:max-w-56 overflow-hidden rounded-[24px] bg-muted/40 shadow-lg">
              {auction.card.imageLarge && (
                <img src={auction.card.imageLarge} className="h-full w-full object-fill" alt="" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                 <span className="rounded-lg bg-amber/10 px-2 py-1 text-[10px] font-black text-amber uppercase tracking-wider flex items-center gap-1 border border-amber/20">
                   <Gavel size={12} /> Leilão
                 </span>
                 <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                   isOpen ? "bg-leaf/10 text-leaf border border-leaf/20" : "bg-muted text-muted-foreground border border-card-border"
                 }`}>
                   {isOpen ? "Ativo" : "Encerrado"}
                 </span>
              </div>
              <h1 className="text-3xl font-black text-foreground leading-tight">{auction.card.name}</h1>
              <p className="text-lg font-bold text-muted-foreground">{auction.card.rarity} • {auction.card.setName}</p>
              
              <div className="mt-8 flex items-center gap-3">
                <button 
                  onClick={() => onSelectProfile(auction.sellerSlug || auction.sellerId)}
                  className="group flex items-center gap-3 rounded-2xl border border-card-border bg-card p-2 pr-5 transition hover:border-brand shadow-sm hover:shadow-md"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground group-hover:bg-brand group-hover:text-white transition-colors">
                    {auction.sellerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-brand transition-colors">Vendedor</p>
                    <p className="text-sm font-black text-foreground">{auction.sellerName}</p>
                  </div>
                </button>
              </div>

              {auction.description && (
                <div className="mt-10">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Descrição do Lote</h3>
                  </div>
                  <div className="relative">
                    <p className="text-sm font-medium text-foreground bg-slate-200 dark:bg-slate-800 p-5 rounded-2xl italic leading-relaxed border border-card-border/20">
                      "{auction.description}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center gap-3 mb-6">
            <History size={20} className="text-muted-foreground" />
            <h2 className="text-lg font-black text-foreground">Histórico de Lances</h2>
          </div>
          
          <div className="space-y-3">
            {auction.bids.length === 0 ? (
              <div className="py-12 text-center rounded-3xl border-2 border-dashed border-card-border">
                 <p className="text-sm font-bold text-muted-foreground">Nenhum lance ainda. Seja o primeiro!</p>
              </div>
            ) : (
              auction.bids.map((bid, index) => {
                const isWinner = auction.winningBidId === bid.id;
                return (
                  <div key={bid.id} className={`flex flex-col gap-4 rounded-2xl border p-4 transition-all ${
                    isWinner
                      ? "border-leaf bg-leaf/10 shadow-md ring-1 ring-leaf/20"
                      : index === 0 && isOpen
                        ? "border-amber bg-amber/10 shadow-md ring-1 ring-amber/20" 
                        : "border-card-border/40 bg-card/60"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl font-black text-sm ${
                          isWinner ? "bg-leaf text-white" : index === 0 && isOpen ? "bg-amber text-amber-950" : "bg-muted text-muted-foreground"
                        }`}>
                          {isWinner ? "★" : auction.bids.length - index}
                        </div>
                        <div>
                          <p className="font-black text-foreground">
                            {bid.bidderName}
                            {isWinner && <span className="ml-2 text-[10px] bg-leaf/10 text-leaf px-2 py-0.5 rounded-full uppercase tracking-tighter">Vencedor</span>}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                            {new Date(bid.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black ${isWinner ? "text-leaf" : index === 0 && isOpen ? "text-amber" : "text-foreground"}`}>
                          {formatBrl(bid.amount)}
                        </p>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="flex gap-4 justify-end pt-2 border-t border-card-border/20">
                        {auction.status === "closed" && !auction.winningBidId && (
                          <button
                            onClick={() => handleSelectWinner(bid.id)}
                            className="text-[10px] font-black uppercase text-leaf hover:underline"
                          >
                            Escolher como vencedor
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteBid(bid.id)}
                          className="text-[10px] font-black uppercase text-magenta hover:underline"
                        >
                          Remover lance
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Panel>
      </div>

      <aside className="space-y-6">
        <div className="flex flex-col items-start space-y-6">
          <Panel className="bg-white/50 dark:bg-slate-900 w-full  text-background shadow-2xl overflow-hidden">
            {/* <div className="flex items-center justify-between mb-6">
               <div className="flex items-center gap-2 opacity-60">
                 <Timer size={18} className="text-amber" />
                 <span className="text-xs font-black uppercase tracking-widest">
                   {isOpen ? "Tempo Restante" : "Finalizado em"}
                 </span>
               </div>
               {!isOpen && <span className="rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-black uppercase">FIM</span>}
            </div> */}

            <div className="mb-8 p-6 bg-slate-200 dark:bg-slate-800 rounded-[24px] bg-background/10 border border-background/10">
               <p className="text-[10px] text-ink dark:text-white font-black uppercase tracking-[0.2em] mb-2 opacity-60">
                 {auction.currentBid ? "Lance Atual" : "Lance Inicial"}
               </p>
               <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black text-amber">
                    {formatBrl(auction.currentBid ?? auction.minBid)}
                 </span>
               </div>
               <p className="text-xs font-bold opacity-40 mt-3 text-ink dark:text-white">
                 Total de <span className="opacity-90">{auction.bidCount}</span> lances
               </p>
            </div>

            {isOpen ? (
              <div className="space-y-4 ">
                {isOwner ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-200 dark:bg-slate-800 bg-background/10 p-4 border border-background/10">
                      <p className="text-xs text-ink dark:text-white font-bold opacity-70 text-center mb-4">
                        Você é o dono deste leilão.
                      </p>
                      <Button
                        variant="brand"
                        className="w-full h-12 text-sm bg-magenta hover:bg-magenta/80 border-none"
                        onClick={handleClose}
                        disabled={submitting}
                      >
                        Finalizar Agora
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-ink dark:text-white opacity-50 px-1">Seu Lance (Min {formatBrl(minNextBid)})</label>
                       <div className="relative flex items-center justify-center">
                         <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-600 dark:text-white/80 text-lg">R$</span>
                         <input 
                           className="w-full h-14 text-slate-600 dark:text-white/80 placeholder:text-slate-400/40 dark:placeholder:text-ink/60 rounded-2xl bg-slate-200 dark:bg-slate-700 border border-background/10 focus:border-amber focus:ring-amber/20 font-black text-xl pl-12 outline-none transition-all"
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
                      <div className={`rounded-xl p-4 text-xs font-bold ${
                        message.type === "success" ? "bg-leaf/20 text-leaf" : "bg-magenta/20 text-magenta"
                      }`}>
                        <p>{message.text}</p>
                        {message.text.includes("WhatsApp") && (
                          <Button
                            variant="outline"
                            className="mt-3 w-full h-10 border-background/20 text-background hover:bg-background/10"
                            onClick={() => onNavigate({ view: "profile", returnTo: window.location.href })}
                          >
                            Ir para o Perfil
                          </Button>
                        )}
                      </div>
                    )}

                    <Button
                      variant="brand"
                      className="w-full h-14 text-base shadow-glow shadow-amber/20 bg-amber text-amber-950 hover:bg-amber/90 border-none"
                      disabled={submitting || !bidAmount || Number(bidAmount) < minNextBid}
                      onClick={handleBid}
                    >
                      {submitting ? "Processando..." : "Confirmar Lance"}
                    </Button>
                    
                    {!session && (
                      <p className="text-[10px] text-ink dark:text-white font-bold opacity-40 text-center">
                        Você precisa estar logado para dar lances.
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-background/5 p-6 border border-background/10 text-center">
                 <p className="text-sm font-black text-background">Este leilão foi encerrado.</p>
                 <p className="text-xs font-medium opacity-40 mt-1">
                   {auction.currentBid ? "Vendido pelo maior lance." : "Encerrado sem lances."}
                 </p>
              </div>
            )}
          </Panel>

          <Panel className="bg-muted/30 w-full border-card-border/40">
             <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4 px-1">Informações</h3>
             <div className="space-y-4">
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Iniciado em</span>
                 <span className="text-xs font-black text-foreground">{new Date(auction.createdAt).toLocaleDateString()}</span>
               </div>
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Encerra em</span>
                 <span className="text-xs font-black text-foreground">{new Date(auction.endsAt).toLocaleDateString()}</span>
               </div>
               <div className="flex justify-between items-center px-1">
                 <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">ID</span>
                 <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-md">{auction.id.slice(0, 12)}</span>
               </div>
             </div>
          </Panel>
        </div>
      </aside>
    </div>
  );
}
