import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  ExternalLink, 
  Gavel, 
  Globe, 
  ShoppingBag, 
  User as UserIcon,
  Check,
  Copy,
  AlertCircle,
  Loader2,
  RotateCw,
  Send,
} from "lucide-react";
import { api, apiFeedback, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { Modal } from "./ui/Modal";
import { formatBrl } from "../lib/format";
import type { CollectionCartOffer } from "@poke-organizer/shared";

function offerStatusLabel(status: CollectionCartOffer["status"]) {
  if (status === "accepted") return "Aceita";
  if (status === "rejected") return "Recusada";
  if (status === "countered") return "Contraproposta";
  if (status === "buyer_accepted") return "Aguardando confirmação";
  return "Pendente";
}

function offerStatusClass(status: CollectionCartOffer["status"]) {
  if (status === "accepted") return "bg-leaf text-white";
  if (status === "rejected") return "bg-magenta text-white";
  if (status === "countered") return "bg-cyan/15 text-cyan";
  if (status === "buyer_accepted") return "bg-brand/15 text-brand";
  return "bg-amber/20 text-amber";
}

function eventLabel(type: CollectionCartOffer["events"][number]["type"]) {
  if (type === "initial_offer") return "Proposta inicial";
  if (type === "counter_offer") return "Contraproposta";
  if (type === "buyer_accepted") return "Comprador aceitou";
  if (type === "seller_accepted") return "Vendedor confirmou";
  if (type === "rejected") return "Negociação encerrada";
  return "Mensagem";
}

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onBack: () => void;
  initialTab?: string | null;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  blockedNavigationAt?: number;
};

function DetailedProposalModal({ offer, onClose }: { offer: CollectionCartOffer; onClose: () => void }) {
  return (
    <Modal
      title="Detalhes da Proposta"
      subtitle={`De: ${offer.buyerName} • ${new Date(offer.createdAt).toLocaleDateString()}`}
      icon={<RotateCw size={20} />}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
    >
      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offer.items.map((item) => {
            const marketPrice = item.item.price?.amount;
            const customPrice = item.item.customPrice;
            return (
              <div key={item.id} className="relative flex items-start gap-3 rounded-2xl bg-muted/20 p-3 border border-card-border/40 shadow-sm transition hover:border-card-border/60">
                <img 
                  src={item.item.card.imageSmall ?? ""} 
                  alt={item.item.card.name} 
                  className="h-16 w-12 rounded-lg object-cover shadow-sm bg-muted"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black text-brand uppercase tracking-tighter bg-brand/10 px-1.5 py-0.5 rounded">
                      {item.quantity}x
                    </span>
                    <h4 className="truncate text-xs font-black text-foreground">{item.item.card.name}</h4>
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-card-border/20">
                      #{item.item.card.number} {item.item.card.setCode?.toUpperCase()}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-card-border/20">
                      {item.item.variant === "normal" ? "Normal" : item.item.variant.charAt(0).toUpperCase() + item.item.variant.slice(1)}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-card-border/20 uppercase">
                      {item.item.language}
                    </span>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Vlr. Mercado</span>
                      <span className="text-[10px] font-black text-foreground">{formatBrl(marketPrice ?? 0)}</span>
                    </div>
                    {customPrice !== null && customPrice !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-brand uppercase tracking-tight">Vlr. Customizado</span>
                        <span className="text-[10px] font-black text-brand">{formatBrl(customPrice)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-card-border/10 mt-1 pt-1">
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-tight">Vlr. Proposta</span>
                      <span className="text-[11px] font-black text-cyan">{formatBrl(item.amount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {offer.message && (
          <div className="rounded-2xl bg-muted/30 p-4 border border-card-border/30">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Mensagem</p>
            <p className="text-sm italic text-foreground">"{offer.message}"</p>
          </div>
        )}

        <div className="rounded-2xl bg-muted/20 p-4 border border-card-border/30">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3">Histórico da negociação</p>
          <div className="space-y-3">
            {(offer.events?.length ? offer.events : []).map((event) => (
              <div key={event.id} className="rounded-xl border border-card-border/30 bg-card/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-foreground">{eventLabel(event.type)} • {event.senderName}</p>
                  <p className="text-[10px] font-bold text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
                {event.proposedTotal !== null && event.proposedTotal !== undefined && (
                  <p className="mt-1 text-sm font-black text-brand">{formatBrl(event.proposedTotal)}</p>
                )}
                {event.message && <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>}
              </div>
            ))}
            {!offer.events?.length && (
              <p className="text-sm font-semibold text-muted-foreground">Sem eventos registrados para esta proposta antiga.</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="sticky bottom-0 border-t border-card-border/50 bg-card p-6 flex items-center justify-between">
         <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total da Proposta</p>
            <p className="text-2xl font-black text-foreground">{formatBrl(offer.totalOffer)}</p>
         </div>
         <Button variant="brand" className="h-11 px-8" onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  );
}

function CounterProposalModal({
  offer,
  submitting,
  onClose,
  onSubmit,
}: {
  offer: CollectionCartOffer;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (totalOffer: number, message?: string) => void;
}) {
  const [amount, setAmount] = useState(String(offer.totalOffer));
  const [message, setMessage] = useState("");

  return (
    <Modal
      title="Enviar contraproposta"
      subtitle={`Proposta atual: ${formatBrl(offer.totalOffer)}`}
      icon={<Send size={20} />}
      onClose={onClose}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-5 p-6">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Novo valor total</label>
          <input
            className="premium-input w-full text-lg font-black"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Mensagem para o comprador</label>
          <textarea
            className="premium-input min-h-[110px] w-full resize-none"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Explique o ajuste de valor ou combine detalhes da negociação."
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t border-card-border/40 p-5">
        <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button
          variant="brand"
          icon={submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          onClick={() => onSubmit(Number(amount.replace(",", ".")), message)}
          disabled={submitting}
        >
          Enviar
        </Button>
      </div>
    </Modal>
  );
}

export function ProfilePage({ session, onSession, onUnauthorized, onBack, initialTab, onUnsavedChanges, blockedNavigationAt }: Props) {
  const urlParams = new URLSearchParams(window.location.search);
  const initialSubTab = urlParams.get("subTab") as "sent" | "received" | null;
  const initialProposalId = urlParams.get("proposalId");
  const collectionFilterId = urlParams.get("collectionId") || urlParams.get("collection"); // support both

  const [tab, setTab] = useState<"proposals" | "settings">(initialTab === "settings" ? "settings" : "proposals");
  const [selectedOffer, setSelectedOffer] = useState<CollectionCartOffer | null>(null);
  const [counterOffer, setCounterOffer] = useState<CollectionCartOffer | null>(null);
  const [submittingOfferAction, setSubmittingOfferAction] = useState(false);
  
  const [shouldShake, setShouldShake] = useState(false);

  useEffect(() => {
    if (blockedNavigationAt && blockedNavigationAt > 0) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 800);
      return () => clearTimeout(timer);
    }
  }, [blockedNavigationAt]);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab === "settings" ? "settings" : "proposals");
    }
  }, [initialTab]);

  const [proposals, setProposals] = useState<CollectionCartOffer[]>([]);
  const [receivedProposals, setReceivedProposals] = useState<CollectionCartOffer[]>([]);
  const [proposalsSubTab, setProposalsSubTab] = useState<"sent" | "received">(initialSubTab || "sent");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initialProposalId) {
       const allProposals = [...proposals, ...receivedProposals];
       const found = allProposals.find(p => p.id === initialProposalId);
       if (found) {
         setSelectedOffer(found);
         setProposalsSubTab(proposals.some(p => p.id === initialProposalId) ? "sent" : "received");
       }
    }
  }, [initialProposalId, proposals, receivedProposals]);

  const [name, setName] = useState(session.user.name || "");
  const [whatsapp, setWhatsapp] = useState(session.user.whatsapp || "");
  const [state, setState] = useState(session.user.state || "");
  const [city, setCity] = useState(session.user.city || "");
  const [profileSlug, setProfileSlug] = useState(session.user.profileSlug || "");
  const [profileBio, setProfileBio] = useState(session.user.profileBio || "");
  const [isPublicProfile, setIsPublicProfile] = useState(session.user.isPublicProfile || false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const changed = 
      name !== (session.user.name || "") ||
      whatsapp !== (session.user.whatsapp || "") ||
      state !== (session.user.state || "") ||
      city !== (session.user.city || "") ||
      profileSlug !== (session.user.profileSlug || "") ||
      profileBio !== (session.user.profileBio || "") ||
      isPublicProfile !== (session.user.isPublicProfile || false);
    
    onUnsavedChanges?.(changed);
  }, [name, whatsapp, state, city, profileSlug, profileBio, isPublicProfile, session.user, onUnsavedChanges]);

  useEffect(() => {
    if (!profileSlug || profileSlug === session.user.profileSlug) {
      setSlugStatus("idle");
      return;
    }

    if (profileSlug.length < 3) {
      setSlugStatus("invalid");
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus("checking");
      try {
        const { available } = await api.checkProfileSlug(profileSlug);
        setSlugStatus(available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [profileSlug, session.user.profileSlug]);

  async function loadSentProposals() {
    setLoading(true);
    try {
      const sent = await withAuthRetry(session, onSession, onUnauthorized, (token) => api.listMyProposals(token));
      setProposals(sent);
    } catch (err) {
      console.error("Failed to load sent proposals", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadReceivedProposals() {
    setLoading(true);
    try {
      const received = await withAuthRetry(session, onSession, onUnauthorized, (token) => api.listReceivedProposals(token));
      setReceivedProposals(received);
    } catch (err) {
      console.error("Failed to load received proposals", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadProposals() {
    setLoading(true);
    try {
      const [sent, received] = await withAuthRetry(session, onSession, onUnauthorized, async (token) => {
        return Promise.all([
          api.listMyProposals(token),
          api.listReceivedProposals(token)
        ]);
      });
      setProposals(sent);
      setReceivedProposals(received);
    } catch (err) {
      console.error("Failed to load profile data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProposals();
  }, [session, onSession, onUnauthorized]);

  async function handleDecideOffer(offer: CollectionCartOffer, status: "accepted" | "rejected") {
    setSubmittingOfferAction(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.decideCollectionOffer(token, offer.folderId, offer.id, status)
      );
      apiFeedback.success(status === "accepted" ? "Proposta aceita e pedido aberto!" : "Proposta recusada.");
      void loadProposals();
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao decidir proposta");
    } finally {
      setSubmittingOfferAction(false);
    }
  }

  async function handleCounterOffer(offer: CollectionCartOffer, totalOffer: number, message?: string) {
    if (!Number.isFinite(totalOffer) || totalOffer <= 0) {
      apiFeedback.error("Informe um valor maior que zero.");
      return;
    }
    setSubmittingOfferAction(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.counterCollectionOffer(token, offer.folderId, offer.id, {
          totalOffer,
          message: message?.trim() || undefined,
        })
      );
      setCounterOffer(null);
      apiFeedback.success("Contraproposta enviada.");
      void loadProposals();
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao enviar contraproposta");
    } finally {
      setSubmittingOfferAction(false);
    }
  }

  async function handleRespondCounterOffer(offer: CollectionCartOffer, status: "accepted" | "rejected") {
    setSubmittingOfferAction(true);
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.respondCollectionCounterOffer(token, offer.folderId, offer.id, status)
      );
      apiFeedback.success(status === "accepted" ? "Contraproposta aceita. Aguardando confirmação do vendedor." : "Contraproposta recusada.");
      void loadProposals();
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao responder contraproposta");
    } finally {
      setSubmittingOfferAction(false);
    }
  }

  async function handleUpdateProfile() {
    setMessage(null);
    setUpdating(true);
    try {
      const updatedUser = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateUserProfile(token, {
          name,
          whatsapp,
          state,
          city,
          profileSlug,
          profileBio,
          isPublicProfile
        })
      );
      
      // Update session with new user data
      onSession({
        ...session,
        user: {
          ...session.user,
          ...updatedUser
        }
      });

      setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
      apiFeedback.success("Perfil atualizado com sucesso!");
      
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      if (returnTo) {
        setTimeout(() => {
          window.location.href = returnTo;
        }, 1200);
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao atualizar perfil" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/public/profile/${profileSlug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {selectedOffer && (
        <DetailedProposalModal 
          offer={selectedOffer} 
          onClose={() => setSelectedOffer(null)} 
        />
      )}
      {counterOffer && (
        <CounterProposalModal
          offer={counterOffer}
          submitting={submittingOfferAction}
          onClose={() => setCounterOffer(null)}
          onSubmit={(totalOffer, message) => handleCounterOffer(counterOffer, totalOffer, message)}
        />
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-card-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground shadow-sm"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground">
              {tab === "proposals" ? "Propostas de Negociação" : "Configurações de Perfil"}
            </h1>
            <p className="text-sm font-semibold text-muted-foreground">
              {tab === "proposals" 
                ? "Gerencie as propostas enviadas e recebidas em coleções." 
                : "Gerencie suas informações e visibilidade do seu perfil público."}
            </p>
          </div>
        </div>
      </div>

      <Panel className="p-0 overflow-hidden border-card-border/40">
        {loading ? (
          <div className="py-24 text-center font-black text-muted-foreground animate-pulse">Carregando dados...</div>
        ) : (
          <div className="divide-y divide-card-border/20">
            {tab === "proposals" ? (
              <>
                <div className="bg-muted/10 p-4 border-b border-card-border/20 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-2 rounded-2xl bg-muted/30 p-1 w-fit">
                        <button
                            className={`rounded-xl px-6 py-2 text-xs font-black transition ${proposalsSubTab === "sent" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setProposalsSubTab("sent")}
                        >
                            Propostas que eu fiz
                        </button>
                        <button
                            className={`rounded-xl px-6 py-2 text-xs font-black transition ${proposalsSubTab === "received" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setProposalsSubTab("received")}
                        >
                            Propostas que recebi
                        </button>
                    </div>

                    <Button
                      variant="outline"
                      className="h-9 px-4 text-xs font-black gap-2 border-card-border/40 hover:bg-card"
                      icon={<RotateCw size={14} className={loading ? "animate-spin" : ""} />}
                      onClick={() => proposalsSubTab === "sent" ? loadSentProposals() : loadReceivedProposals()}
                      disabled={loading}
                    >
                      {loading ? "Carregando..." : "Recarregar"}
                    </Button>
                </div>

                {collectionFilterId && (
                  <div className="bg-brand/10 p-4 border-b border-brand/20 flex items-center justify-between">
                    <p className="text-sm font-bold text-brand flex items-center gap-2">
                      <ShoppingBag size={16} /> Mostrando apenas propostas de uma coleção específica
                    </p>
                    <Button variant="ghost" onClick={() => {
                        const url = new URL(window.location.href);
                        url.searchParams.delete('collectionId');
                        url.searchParams.delete('collection');
                        window.history.pushState({}, '', url);
                        // Trigger re-render by doing a shallow nav or state update. Let's just force reload for simplicity or we can add a state.
                        window.location.reload();
                    }}>Limpar filtro</Button>
                  </div>
                )}

                {(() => {
                   const listToRender = (proposalsSubTab === "sent" ? proposals : receivedProposals).filter(p => collectionFilterId ? p.folderId === collectionFilterId : true);
                   
                   return listToRender.length === 0 ? (
                      <div className="py-24 text-center">
                        <p className="text-sm font-bold text-muted-foreground">
                            {collectionFilterId ? "Nenhuma proposta encontrada para esta coleção." : (proposalsSubTab === "sent" 
                                ? "Você ainda não fez nenhuma proposta em coleções." 
                                : "Você ainda não recebeu nenhuma proposta em suas coleções.")}
                        </p>
                      </div>
                    ) : (
                      listToRender.map((offer) => (
                        <div key={offer.id} className="p-4 sm:p-6 transition hover:bg-accent/30 border-b border-card-border/20 last:border-0">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Proposta</span>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${offerStatusClass(offer.status)}`}>
                              {offerStatusLabel(offer.status)}
                            </span>
                            {offer.isGlobalOffer && (
                                <span className="rounded-lg bg-brand px-2 py-1 text-[10px] font-black text-white uppercase tracking-tighter">
                                    Global
                                </span>
                            )}
                          </div>
                          
                          <div className="mt-2">
                             {proposalsSubTab === "received" && (
                                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">De: {offer.buyerName}</p>
                             )}
                             <h3 className="text-xl sm:text-2xl font-black text-foreground">Valor sugerido: {formatBrl(offer.totalOffer)}</h3>
                             <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                {proposalsSubTab === "sent" ? "Enviada" : "Recebida"} em: {new Date(offer.createdAt).toLocaleDateString()}
                             </p>
                          </div>
                          
                          <div 
                            className="mt-4 flex flex-wrap gap-2 cursor-pointer group/items"
                            onClick={() => setSelectedOffer(offer)}
                          >
                            {offer.items.slice(0, 10).map((item) => (
                              <div key={item.id} className="rounded-xl bg-card px-3 py-1.5 text-[10px] sm:text-xs font-bold text-muted-foreground border border-card-border/40 shadow-sm group-hover/items:border-brand/40 transition-colors">
                                {item.quantity}x {item.item.card.name}
                              </div>
                            ))}
                            {offer.items.length > 10 && (
                              <div className="rounded-xl bg-brand/10 px-3 py-1.5 text-[10px] sm:text-xs font-black text-brand border border-brand/20 shadow-sm">
                                +{offer.items.length - 10} cartas (Ver todas)
                              </div>
                            )}
                          </div>

                          {offer.message && (
                            <div className="mt-4 rounded-2xl bg-muted/20 p-4 border border-card-border/30">
                                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Mensagem</p>
                                <p className="text-sm italic text-foreground">"{offer.message}"</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                            {proposalsSubTab === "received" && (offer.status === "pending" || offer.status === "buyer_accepted") && (
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="brand"
                                        className="h-11 flex-1 md:px-6 bg-leaf hover:bg-emerald-600 text-white border-none shadow-sm"
                                        onClick={() => handleDecideOffer(offer, "accepted")}
                                        disabled={submittingOfferAction}
                                    >
                                        {offer.status === "buyer_accepted" ? "Confirmar pedido" : "Aceitar"}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-11 flex-1 md:px-6 text-magenta border-magenta/20 hover:bg-magenta/5"
                                        onClick={() => handleDecideOffer(offer, "rejected")}
                                        disabled={submittingOfferAction}
                                    >
                                        Recusar
                                    </Button>
                                </div>
                            )}
                            {proposalsSubTab === "received" && (offer.status === "pending" || offer.status === "countered") && (
                              <Button
                                variant="outline"
                                className="h-11 px-6 text-sm w-full md:w-auto border-cyan/30 text-cyan hover:bg-cyan/5"
                                icon={<Send size={16} />}
                                onClick={() => setCounterOffer(offer)}
                                disabled={submittingOfferAction}
                              >
                                {offer.status === "countered" ? "Ajustar contraproposta" : "Contrapropor"}
                              </Button>
                            )}
                            {proposalsSubTab === "received" && offer.status === "countered" && (
                              <Button
                                variant="outline"
                                className="h-11 px-6 text-sm w-full md:w-auto text-magenta border-magenta/20 hover:bg-magenta/5"
                                onClick={() => handleDecideOffer(offer, "rejected")}
                                disabled={submittingOfferAction}
                              >
                                Encerrar
                              </Button>
                            )}
                            {proposalsSubTab === "sent" && offer.status === "countered" && (
                              <div className="flex gap-2 w-full">
                                <Button
                                  variant="brand"
                                  className="h-11 flex-1 md:px-6 bg-leaf hover:bg-emerald-600 text-white border-none shadow-sm"
                                  onClick={() => handleRespondCounterOffer(offer, "accepted")}
                                  disabled={submittingOfferAction}
                                >
                                  Aceitar contraproposta
                                </Button>
                                <Button
                                  variant="outline"
                                  className="h-11 flex-1 md:px-6 text-magenta border-magenta/20 hover:bg-magenta/5"
                                  onClick={() => handleRespondCounterOffer(offer, "rejected")}
                                  disabled={submittingOfferAction}
                                >
                                  Recusar
                                </Button>
                              </div>
                            )}
                            <Button
                                variant="outline"
                                className="h-11 px-6 text-sm w-full md:w-auto border-card-border/60"
                                icon={<ExternalLink size={16} />}
                                onClick={() => setSelectedOffer(offer)}
                            >
                                Ver Detalhes
                            </Button>
                            <Button
                                variant={proposalsSubTab === "sent" ? "brand" : "outline"}
                                className="h-11 px-6 text-sm w-full md:w-auto"
                                icon={<ShoppingBag size={16} />}
                                onClick={() => {
                                  const url = proposalsSubTab === "sent"?`/p/${offer.folderShareToken}`:`/?page=collections&collection=${offer.folderId}`;
                                  window.location.href = url
                                }}
                            >
                                {proposalsSubTab === "sent" ? "Ver Coleção" : "Ir para Coleção"}
                            </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )})()}
              </>
            ) : (
              <div className="p-8 space-y-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">E-mail</label>
                    <input
                      className="premium-input w-full opacity-60 cursor-not-allowed"
                      value={session.user.email}
                      disabled
                      title="O e-mail não pode ser alterado"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome de Exibição</label>
                    <input
                      className="premium-input w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome ou apelido"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">WhatsApp</label>
                    <input
                      className="premium-input w-full"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Ex: 11999999999"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Estado (UF)</label>
                      <input
                        className="premium-input w-full"
                        value={state}
                        onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                        placeholder="Ex: SP"
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cidade</label>
                      <input
                        className="premium-input w-full"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Ex: São Paulo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Link do Perfil (Slug)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">@</span>
                      <input
                        className={`premium-input w-full pl-10 pr-10 ${
                          slugStatus === "available" ? "border-leaf/50 focus:border-leaf" :
                          slugStatus === "taken" || slugStatus === "invalid" ? "border-magenta/50 focus:border-magenta" : ""
                        }`}
                        value={profileSlug}
                        onChange={(e) => setProfileSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="seu-apelido"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" && <Loader2 size={18} className="animate-spin text-muted-foreground" />}
                        {slugStatus === "available" && <Check size={18} className="text-leaf" />}
                        {(slugStatus === "taken" || slugStatus === "invalid") && <AlertCircle size={18} className="text-magenta" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <p className={`text-[10px] font-bold ${
                        slugStatus === "taken" ? "text-magenta" :
                        slugStatus === "available" ? "text-leaf" :
                        slugStatus === "invalid" ? "text-magenta" : "text-muted-foreground"
                      }`}>
                        {slugStatus === "taken" ? "Este link já está em uso" :
                         slugStatus === "available" ? "Link disponível!" :
                         slugStatus === "invalid" ? "Mínimo 3 caracteres" :
                         "coleciona.cards/public/profile/" + (profileSlug || "seu-apelido")}
                      </p>
                      
                      {profileSlug && !["taken", "invalid"].includes(slugStatus) && (
                        <button 
                          onClick={handleCopyLink}
                          className="flex items-center gap-1 text-[10px] font-black text-brand uppercase hover:underline"
                        >
                          {copied ? <Check size={10} /> : <Copy size={10} />}
                          {copied ? "Copiado!" : "Copiar Link"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Biografia</label>
                  <textarea
                    className="premium-input w-full min-h-[120px] py-4"
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Conte um pouco sobre você e sua coleção..."
                  />
                </div>

                <div className="flex items-center justify-between rounded-[24px] border border-card-border/40 bg-muted/20 p-6">
                  <div className="flex items-center gap-4">
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl ${isPublicProfile ? "bg-leaf text-white" : "bg-muted text-muted-foreground"}`}>
                      <Globe size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-foreground">Perfil Público</h4>
                      <p className="text-xs font-semibold text-muted-foreground">Permitir que qualquer pessoa veja seu perfil e coleções públicas.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublicProfile}
                    onChange={(e) => setIsPublicProfile(e.target.checked)}
                    className="h-7 w-7 rounded-lg border-card-border text-brand focus:ring-brand/30"
                  />
                </div>

                {message && (
                  <div className={`rounded-2xl p-4 text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
                    message.type === "success" ? "bg-leaf/10 text-leaf" : "bg-magenta/10 text-magenta"
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="flex justify-end border-t border-card-border/30 pt-8">
                  <Button
                    variant="brand"
                    className="h-12 px-10 shadow-glow"
                    disabled={updating || slugStatus === "taken" || slugStatus === "checking" || slugStatus === "invalid"}
                    onClick={handleUpdateProfile}
                    shake={shouldShake}
                  >
                    {updating ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
