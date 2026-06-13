import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Filter,
  Gavel,
  History,
  Layers,
  MessageCircle,
  Package,
  Send,
  ShoppingBag,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import type { NegotiationDetail, NegotiationMessage, NegotiationSummary, OrderItem } from "@poke-organizer/shared";
import { api, apiFeedback, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import { createNegotiationSocket, type NegotiationSocket } from "../lib/negotiationSocket";
import { Button } from "./ui/Button";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { Panel } from "./ui/Panel";
import { Modal } from "./ui/Modal";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onBack: () => void;
  initialNegotiationId?: string | null;
  onNegotiationRouteChange?: (id: string | null) => void;
};

type Tab = "sales" | "purchases";

export function NegotiationsPage({
  session,
  onSession,
  onUnauthorized,
  onBack,
  initialNegotiationId,
  initialTab,
  initialQuery,
  onNegotiationRouteChange,
}: Props & { initialTab?: Tab, initialQuery?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "sales");
  const [negotiations, setNegotiations] = useState<NegotiationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialNegotiationId ?? null);
  const [detail, setDetail] = useState<NegotiationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "proposal" | "auction">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "negotiating" | "accepted" | "delivered" | "cancelled">("all");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [showArchived, setShowArchived] = useState(false);
  const [message, setMessage] = useState("");
  const [counterAmount, setCounterAmount] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState<null | { action: "delivered" | "cancelled" | "reject" }>(null);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const socketRef = useRef<NegotiationSocket | null>(null);

  const isDetail = Boolean(selectedId);

  const filteredNegotiations = useMemo(() => {
    return negotiations.filter((n) => {
      const typeMatch = filterType === "all" || n.origin === filterType;
      if (!typeMatch) return false;

      const queryMatch = !query.trim() || 
        n.title.toLowerCase().includes(query.toLowerCase()) || 
        n.buyerName.toLowerCase().includes(query.toLowerCase()) || 
        n.sellerName.toLowerCase().includes(query.toLowerCase());
      if (!queryMatch) return false;

      if (filterStatus === "all") return true;
      if (filterStatus === "negotiating") {
        return ["pending", "countered", "buyer_accepted"].includes(n.status);
      }
      if (filterStatus === "accepted") return n.status === "accepted";
      if (filterStatus === "delivered") return n.status === "delivered";
      if (filterStatus === "cancelled") {
        return ["cancelled", "rejected"].includes(n.status);
      }
      return true;
    });
  }, [negotiations, filterType, filterStatus, query]);

  async function load() {
    setLoading(true);
    try {
      const data = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.listNegotiations(token, { tab, showArchived }),
      );
      setNegotiations(data);
    } catch (err) {
      console.error("Failed to load negotiations", err);
    } finally {
      setLoading(false);
    }
  }

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.getNegotiation(token, id),
      );
      setDetail(next);
      setSelectedId(next.id);
      setTab(next.role === "seller" ? "sales" : "purchases");
      if (next.id !== id) onNegotiationRouteChange?.(next.id);
    } catch (err) {
      console.error("Failed to load negotiation", err);
      setSelectedId(null);
      setDetail(null);
      onNegotiationRouteChange?.(null);
    } finally {
      setDetailLoading(false);
    }
  }, [onNegotiationRouteChange, onSession, onUnauthorized, session]);

  useEffect(() => {
    setSelectedId(initialNegotiationId ?? null);
  }, [initialNegotiationId]);

  useEffect(() => {
    void load();
  }, [tab, session, showArchived]);

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [loadDetail, selectedId]);

  useEffect(() => {
    if (!detail?.id) return;

    const socket = createNegotiationSocket(session.accessToken);
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("negotiation:join", { id: detail.id });
    });
    socket.on("negotiation:detail", (next) => {
      if (next.id !== detail.id) return;
      setDetail((prev) => {
        if (!prev) return next;
        // Merge next into prev to ensure we don't lose local state consistency
        // although 'next' should be complete, React state updates can be tricky with closures
        return { ...next };
      });
    });
    socket.on("negotiation:error", (payload) => {
      console.error("Negotiation socket error", payload.message);
    });
    socket.connect();

    return () => {
      if (socket.connected) socket.emit("negotiation:leave", { id: detail.id });
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [detail?.id, session.accessToken]);

  function openDetail(id: string) {
    setSelectedId(id);
    onNegotiationRouteChange?.(id);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    onNegotiationRouteChange?.(null);
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!detail || !message.trim() || !detail.canChat) return;

    setSending(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.sendNegotiationMessage(token, detail.id, message),
      );
      setDetail(next);
      setMessage("");
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function handleCounterOffer() {
    if (!detail?.proposalId) return;
    const totalOffer = Number(counterAmount.replace(",", "."));
    if (!Number.isFinite(totalOffer) || totalOffer <= 0) {
      apiFeedback.error("Informe um valor maior que zero.");
      return;
    }

    setSending(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.counterNegotiationProposal(token, detail.proposalId!, {
          totalOffer,
          message: counterMessage.trim() || undefined,
        }),
      );
      setDetail(next);
      setCounterAmount("");
      setCounterMessage("");
      setShowCounterModal(false);
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao enviar contraproposta");
    } finally {
      setSending(false);
    }
  }

  async function handleRespondCounter(status: "accepted" | "rejected") {
    if (!detail?.proposalId) return;
    setSending(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.respondNegotiationCounter(token, detail.proposalId!, status),
      );
      setDetail(next);
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao responder contraproposta");
    } finally {
      setSending(false);
    }
  }

  async function handleDecideProposal(status: "accepted" | "rejected") {
    if (!detail?.proposalId) return;
    setSending(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.decideNegotiationProposal(token, detail.proposalId!, status),
      );
      setDetail(next);
      setConfirming(null);
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao decidir proposta");
      setConfirming(null);
    } finally {
      setSending(false);
    }
  }

  async function handleRemoveItem(itemId: string) {
    if (!detail?.proposalId) return;
    setSending(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.removeItemFromNegotiationProposal(token, detail.proposalId!, itemId),
      );
      setDetail(next);
      apiFeedback.success("Item removido da negociação.");
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao remover item");
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateStatus(status: "delivered" | "cancelled") {
    if (!detail) return;
    const targetId = detail.origin === "proposal" ? detail.proposalId : detail.orderId;
    if (!targetId) return;
    setSending(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateNegotiationOrderStatus(token, detail.origin, targetId, status),
      );
      setDetail(next);
      setConfirming(null);
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao atualizar status");
      setConfirming(null);
    } finally {
      setSending(false);
    }
  }

  const title = isDetail ? "Detalhes da negociação" : "Negociações";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={isDetail ? closeDetail : onBack}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-card-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground shadow-sm"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground">{title}</h1>
            <p className="text-sm font-semibold text-muted-foreground">
              {isDetail ? "Converse, negocie e acompanhe o fechamento em um único lugar." : "Propostas e leilões reunidos do início ao pós-venda."}
            </p>
          </div>
        </div>
      </div>

      {isDetail ? (
        <NegotiationDetailView
          currentUserId={session.user.id}
          detail={detail}
          loading={detailLoading}
          message={message}
          sending={sending}
          onMessageChange={setMessage}
          onSendMessage={handleSendMessage}
          onRespondCounter={handleRespondCounter}
          onAcceptProposal={() => handleDecideProposal("accepted")}
          onRejectProposal={() => setConfirming({ action: "reject" })}
          onConfirmDelivered={() => setConfirming({ action: "delivered" })}
          onConfirmCancelled={() => setConfirming({ action: "cancelled" })}
          onRemoveItem={handleRemoveItem}
          onOpenCounterModal={() => {
            setCounterAmount(String(detail?.totalAmount ?? ""));
            setShowCounterModal(true);
          }}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex gap-2 p-1 bg-muted rounded-2xl w-fit">
              <button
                onClick={() => setTab("sales")}
                className={`px-6 py-2 rounded-xl text-sm font-black transition ${tab === "sales" ? "bg-card shadow-sm text-brand" : "text-muted-foreground hover:text-foreground"}`}
              >
                Vendas
              </button>
              <button
                onClick={() => setTab("purchases")}
                className={`px-6 py-2 rounded-xl text-sm font-black transition ${tab === "purchases" ? "bg-card shadow-sm text-brand" : "text-muted-foreground hover:text-foreground"}`}
              >
                Compras
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar negociação..."
                  className="premium-input pl-9 w-full h-9 text-xs"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowFilters(true)}
                className="flex items-center gap-2 px-4 py-2 bg-muted/50 hover:bg-muted transition-colors rounded-2xl h-9 border border-card-border/40"
              >
                <Filter size={14} className="text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtros</span>
              </button>
            </div>
          </div>

          <div className="grid gap-5">
            {loading ? (
              <div className="py-24 text-center font-black text-muted-foreground animate-pulse">Carregando negociações...</div>
            ) : filteredNegotiations.length === 0 ? (
              <div className="py-24 text-center bg-card rounded-[32px] border border-card-border border-dashed">
                <MessageCircle size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-sm font-bold text-muted-foreground">Nenhuma negociação encontrada para os filtros selecionados.</p>
              </div>
            ) : (
              filteredNegotiations.map((negotiation) => (
                <NegotiationCard
                  key={negotiation.id}
                  negotiation={negotiation}
                  onOpen={() => openDetail(negotiation.id)}
                />
              ))
            )}
          </div>
        </>
      )}

      {confirming && detail && (
        <ConfirmationModal
          title={
            confirming.action === "delivered"
              ? "Marcar como entregue"
              : confirming.action === "cancelled"
                ? "Cancelar pedido"
                : "Encerrar negociação"
          }
          description={
            confirming.action === "delivered"
              ? "Ao marcar como entregue, a negociação será finalizada e o chat ficará somente leitura."
              : confirming.action === "cancelled"
                ? "Ao cancelar, a negociação será finalizada e o chat ficará somente leitura."
                : "Ao recusar, a negociação será encerrada e o chat ficará somente leitura."
          }
          confirmLabel={
            confirming.action === "delivered"
              ? "Marcar como entregue"
              : confirming.action === "cancelled"
                ? "Cancelar pedido"
                : "Recusar proposta"
          }
          cancelLabel="Voltar"
          confirmVariant={confirming.action === "delivered" ? "brand" : "ghost"}
          onConfirm={() => {
            if (confirming.action === "reject") void handleDecideProposal("rejected");
            else void handleUpdateStatus(confirming.action);
          }}
          onCancel={() => setConfirming(null)}
        />
      )}

      {showCounterModal && detail && (
        <CounterOfferModal
          totalAmount={detail.totalAmount}
          counterAmount={counterAmount}
          counterMessage={counterMessage}
          sending={sending}
          onAmountChange={setCounterAmount}
          onMessageChange={setCounterMessage}
          onConfirm={handleCounterOffer}
          onCancel={() => setShowCounterModal(false)}
        />
      )}

      {showFilters && (
        <Modal
          title="Filtros de Negociação"
          icon={<Filter size={20} />}
          onClose={() => setShowFilters(false)}
          maxWidthClass="max-w-md"
        >
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ShoppingBag size={14} /> Tipos de Negociação
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="premium-input w-full h-12 px-4 font-bold text-sm"
              >
                <option value="all">Tudo</option>
                <option value="proposal">Propostas</option>
                <option value="auction">Leilões</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <History size={14} /> Situação
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="premium-input w-full h-12 px-4 font-bold text-sm"
              >
                <option value="all">Tudo</option>
                <option value="negotiating">Em Negociação</option>
                <option value="accepted">Aceito</option>
                <option value="delivered">Entregues</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>

            <div className="pt-4 border-t border-card-border/40">
              <label className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`grid h-8 w-8 place-items-center rounded-lg ${showArchived ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>
                    <Package size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-black text-foreground">Exibir arquivadas</span>
                    <p className="text-[10px] font-bold text-muted-foreground">Mostrar negociações que já foram concluídas ou canceladas.</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="h-6 w-6 rounded-lg border-card-border text-brand focus:ring-brand"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
              </label>
            </div>
            
            <Button variant="brand" className="w-full h-12" onClick={() => setShowFilters(false)}>
              Aplicar Filtros
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CounterOfferModal({
  totalAmount,
  counterAmount,
  counterMessage,
  sending,
  onAmountChange,
  onMessageChange,
  onConfirm,
  onCancel,
}: {
  totalAmount: number;
  counterAmount: string;
  counterMessage: string;
  sending: boolean;
  onAmountChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Panel className="w-full max-w-md shadow-2xl border-card-border" title="Enviar contraproposta">
        <p className="mb-4 text-sm font-semibold text-muted-foreground">
          Valor atual da negociação: <span className="text-foreground font-black">{formatBrl(totalAmount)}</span>
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Novo Valor (R$)</label>
            <input
              className="premium-input h-12 w-full font-black text-lg"
              inputMode="decimal"
              value={counterAmount}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Mensagem (Opcional)</label>
            <textarea
              className="premium-input min-h-24 w-full py-3 resize-none"
              value={counterMessage}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="Explique o motivo da sua contraproposta..."
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <Button variant="ghost" className="flex-1 h-12" onClick={onCancel} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="brand" className="flex-1 h-12" icon={<Send size={18} />} onClick={onConfirm} disabled={sending}>
            Enviar
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function NegotiationCard({ negotiation, onOpen }: { negotiation: NegotiationSummary; onOpen: () => void }) {
  const otherParty = negotiation.role === "seller" ? negotiation.buyerName : negotiation.sellerName;
  const itemCount = negotiation.items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Panel className="p-0 overflow-hidden cursor-pointer hover:border-brand/30 transition shadow-sm" onClick={onOpen}>
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <OriginIcon origin={negotiation.origin} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <OriginBadge origin={negotiation.origin} />
              <StatusBadge status={negotiation.status} />
            </div>
            <h3 className="font-black text-foreground truncate">{negotiation.title}</h3>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-muted-foreground">
                {negotiation.role === "seller" ? "Com comprador" : "Com vendedor"}: {otherParty}
              </p>
              <div className="flex items-center gap-1.5 text-muted-foreground/60">
                <Clock size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {new Date(negotiation.createdAt).toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            </div>
        </div>
        
        <div className="flex flex-col sm:items-end justify-center">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Layers size={14} />
            <span className="text-xs font-black uppercase tracking-widest">{itemCount} {itemCount === 1 ? "Item" : "Itens"}</span>
          </div>
          <p className="text-xl font-black text-brand">{formatBrl(negotiation.totalAmount)}</p>
        </div>

        <div className="hidden sm:block pl-4 border-l border-card-border/30">
          <Button variant="ghost" className="h-11 w-11 p-0 rounded-2xl" icon={<ChevronRight size={22} />} onClick={(e) => { e.stopPropagation(); onOpen(); }} />
        </div>
      </div>
    </Panel>
  );
}

function NegotiationDetailView({
  currentUserId,
  detail,
  loading,
  message,
  sending,
  onMessageChange,
  onSendMessage,
  onRespondCounter,
  onAcceptProposal,
  onRejectProposal,
  onConfirmDelivered,
  onConfirmCancelled,
  onRemoveItem,
  onOpenCounterModal,
}: {
  currentUserId: string;
  detail: NegotiationDetail | null;
  loading: boolean;
  message: string;
  sending: boolean;
  onMessageChange: (value: string) => void;
  onSendMessage: (event: FormEvent) => void;
  onRespondCounter: (status: "accepted" | "rejected") => void;
  onAcceptProposal: () => void;
  onRejectProposal: () => void;
  onConfirmDelivered: () => void;
  onConfirmCancelled: () => void;
  onRemoveItem: (itemId: string) => void;
  onOpenCounterModal: () => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messages = useMemo(() => detail?.messages ?? [], [detail?.messages]);
  const latestActionMessage = useMemo(() => {
    if (detail?.actionMessageId) {
      const actionMessage = messages.find((entry) => entry.id === detail.actionMessageId);
      if (actionMessage) return actionMessage;
    }

    return [...messages].reverse().find((entry) =>
      entry.type === "initial_offer" ||
      entry.type === "counter_offer" ||
      entry.type === "buyer_accepted"
    ) ?? null;
  }, [detail?.actionMessageId, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (loading || !detail) {
    return <div className="py-24 text-center font-black text-muted-foreground animate-pulse">Carregando negociação...</div>;
  }

  const isSeller = detail.sellerId === currentUserId;
  const isBuyer = detail.buyerId === currentUserId;
  
  const otherParty = isSeller ? detail.buyerName : detail.sellerName;
  const readonly = !detail.canChat;
  const proposalStatus = detail.proposalStatus ?? detail.status;
  const isActiveProposal = detail.origin === "proposal" && !detail.orderId && detail.canChat && (
    proposalStatus === "pending" ||
    proposalStatus === "countered" ||
    proposalStatus === "buyer_accepted"
  );
  const canAnswerProposal = isActiveProposal && detail.actionTargetUserId === currentUserId;
  const canAcceptProposalInChat = canAnswerProposal && isSeller;
  const canRejectProposalInChat = canAnswerProposal;
  const canCounterOfferInChat = canAnswerProposal;
  const canBuyerRespondCounter = canAnswerProposal && isBuyer && proposalStatus === "countered";

  // Stable permission flags independent of the socket's 'role' context
  const canUpdateStatus = isSeller && detail.origin === "auction" 
    ? detail.status === "pending" 
    : (isSeller && !!detail.orderId && detail.orderStatus === "pending");

  const canRemoveItems = isSeller && !detail.orderId && (detail.status === "pending" || detail.status === "countered");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_430px]">
      <div className="space-y-6">
        <Panel className="p-0 overflow-hidden">
          <div className="p-5 border-b border-card-border/30 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <OriginIcon origin={detail.origin} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <OriginBadge origin={detail.origin} />
                  <StatusBadge status={detail.status} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {isSeller ? `Comprador: ${otherParty}` : `Vendedor: ${otherParty}`}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-foreground">{detail.title}</h2>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-black text-brand">{formatBrl(detail.totalAmount)}</p>
                  {canRemoveItems && (
                    <span className="text-[10px] font-bold text-muted-foreground/60 italic">
                      (Passe o mouse nos itens para remover)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {canUpdateStatus && (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black text-magenta uppercase hover:bg-magenta/10 rounded-xl transition"
                    onClick={onConfirmCancelled}
                  >
                    <XCircle size={16} />
                    Cancelar
                  </button>
                  <Button variant="brand" className="h-10 px-5" icon={<Truck size={16} />} onClick={onConfirmDelivered}>
                    Entregue
                  </Button>
                </div>
              )}
              {readonly && (
                <p className="rounded-xl border border-card-border/40 bg-muted/30 px-3 py-2 text-xs font-bold text-muted-foreground">
                  Negociação finalizada. O histórico está disponível apenas para leitura.
                </p>
              )}
            </div>
          </div>
          <NegotiationItems 
            items={detail.items} 
            canRemove={canRemoveItems}
            onRemove={onRemoveItem}
          />
        </Panel>
      </div>

      <Panel title="Conversa" description="Todo o histórico da negociação fica aqui.">
        <div className="flex h-[620px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-card-border/40 bg-background/40 p-3">
            {messages.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <MessageCircle size={36} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm font-bold text-muted-foreground">Nenhuma mensagem ainda.</p>
                </div>
              </div>
            ) : (
              (() => {
                const targetIdx = latestActionMessage
                  ? messages.findIndex((entry) => entry.id === latestActionMessage.id)
                  : -1;

                return messages.map((entry, idx) => {
                  const isTarget = idx === targetIdx;
                  const canRespond = isTarget && canAnswerProposal;

                  return (
                    <NegotiationMessageBubble
                      key={entry.id}
                      entry={entry}
                      mine={entry.senderId === currentUserId}
                      actions={canRespond ? {
                        onAccept: canAcceptProposalInChat
                          ? onAcceptProposal
                          : (canBuyerRespondCounter ? () => onRespondCounter("accepted") : undefined),
                        onReject: canRejectProposalInChat
                          ? (isSeller ? onRejectProposal : () => onRespondCounter("rejected"))
                          : undefined,
                        onCounter: canCounterOfferInChat ? onOpenCounterModal : undefined,
                        label: isSeller ? "Aceitar proposta" : "Aceitar contraproposta"
                      } : undefined}
                      sending={sending}
                    />
                  );
                });
              })()
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-3 space-y-2">
            <form onSubmit={onSendMessage} className="flex gap-2">
              <textarea
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
                placeholder={readonly ? "Negociação finalizada" : "Escreva sua mensagem..."}
                className="min-h-14 flex-1 resize-none rounded-2xl border border-card-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
                maxLength={2000}
                disabled={readonly}
              />
              <Button type="submit" variant="brand" className="h-14 px-5" disabled={sending || readonly || !message.trim()}>
                <Send size={18} />
              </Button>
            </form>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function NegotiationMessageBubble({
  entry,
  mine,
  actions,
  sending
}: {
  entry: NegotiationMessage;
  mine: boolean;
  actions?: {
    onAccept?: () => void;
    onReject?: () => void;
    onCounter?: () => void;
    label?: string;
  };
  sending?: boolean;
}) {
  const isSystem = entry.type !== "message" && entry.type !== "order_message";
  const visibleActions = actions && (actions.onAccept || actions.onReject || actions.onCounter) ? actions : null;

  if (isSystem) {
    return (
      <div className="rounded-2xl border border-card-border/40 bg-muted/30 px-4 py-3 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{eventLabel(entry.type)} • {entry.senderName}</p>
        {entry.proposedTotal !== null && entry.proposedTotal !== undefined && (
          <p className="mt-1 text-lg font-black text-brand">{formatBrl(entry.proposedTotal)}</p>
        )}
        {entry.message && <p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-foreground">{entry.message}</p>}

        {visibleActions && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {visibleActions.onAccept && (
              <Button variant="brand" className="h-9 px-4 bg-leaf text-white hover:bg-emerald-600 text-xs" icon={<CheckCircle2 size={14} />} onClick={visibleActions.onAccept} disabled={sending}>
                {visibleActions.label || "Aceitar"}
              </Button>
            )}
            {visibleActions.onCounter && (
              <Button variant="outline" className="h-9 px-4 border-cyan/30 text-cyan hover:bg-cyan/5 text-xs" icon={<Send size={14} />} onClick={visibleActions.onCounter} disabled={sending}>
                Contraproposta
              </Button>
            )}
            {visibleActions.onReject && (
              <Button variant="outline" className="h-9 px-4 text-magenta border-magenta/30 hover:bg-magenta/5 text-xs" icon={<XCircle size={14} />} onClick={visibleActions.onReject} disabled={sending}>
                Recusar
              </Button>
            )}
          </div>
        )}

        <p className="mt-2 text-[10px] font-bold text-muted-foreground">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p>
      </div>
    );
  }


  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-brand text-white" : "bg-card border border-card-border text-foreground"}`}>
        <p className={`mb-1 text-[10px] font-black uppercase tracking-widest ${mine ? "text-white/70" : "text-muted-foreground"}`}>
          {mine ? "Você" : entry.senderName}
        </p>
        <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">{entry.message}</p>
        <p className={`mt-2 text-[10px] font-bold ${mine ? "text-white/60" : "text-muted-foreground"}`}>
          {new Date(entry.createdAt).toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}

function NegotiationItems({ 
  items, 
  compact = false,
  canRemove = false,
  onRemove
}: { 
  items: OrderItem[]; 
  compact?: boolean;
  canRemove?: boolean;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className={`grid gap-3 ${compact ? "p-4 sm:grid-cols-2 lg:grid-cols-3" : "p-5 sm:grid-cols-2"}`}>
      {items.map((item) => (
        <div key={item.id} className="group relative flex items-center gap-3 rounded-2xl border border-card-border/40 bg-muted/20 p-3">
          <div className="h-14 w-10 overflow-hidden rounded-lg bg-input border border-card-border/40 shrink-0">
            {item.imageSmall && <img src={item.imageSmall} alt={item.name} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-foreground">{item.quantity}x {item.name}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">
              {[item.condition, item.variant, item.cardNumber && `#${item.cardNumber}`].filter(Boolean).join(" • ")}
            </p>
          </div>
          <p className="shrink-0 text-sm font-black text-foreground">{formatBrl(item.price)}</p>
          
          {canRemove && onRemove && (
            <button
              onClick={() => onRemove(item.id)}
              className="absolute -right-2 -top-2 hidden h-8 w-8 place-items-center rounded-full bg-magenta text-white shadow-lg transition hover:scale-110 group-hover:grid"
              title="Remover da negociação"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function OriginBadge({ origin }: { origin: NegotiationSummary["origin"] }) {
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${origin === "proposal" ? "bg-cyan/15 text-cyan" : "bg-amber/20 text-amber"}`}>
      {origin === "proposal" ? "Proposta" : "Leilão"}
    </span>
  );
}

function OriginIcon({ origin }: { origin: NegotiationSummary["origin"] }) {
  const Icon = origin === "proposal" ? ShoppingBag : Gavel;
  return (
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${origin === "proposal" ? "bg-cyan/10 text-cyan" : "bg-amber/10 text-amber"}`}>
      <Icon size={22} />
    </div>
  );
}

function StatusBadge({ status }: { status: NegotiationSummary["status"] }) {
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function statusClass(status: NegotiationSummary["status"]) {
  if (status === "delivered") return "bg-leaf text-white";
  if (status === "cancelled" || status === "rejected") return "bg-magenta text-white";
  if (status === "countered") return "bg-cyan/15 text-cyan";
  if (status === "buyer_accepted" || status === "accepted") return "bg-brand/15 text-brand";
  return "bg-amber/20 text-amber";
}

function statusLabel(status: NegotiationSummary["status"]) {
  if (status === "delivered") return "Entregue";
  if (status === "cancelled") return "Cancelada";
  if (status === "rejected") return "Recusada";
  if (status === "countered") return "Contraproposta";
  if (status === "buyer_accepted") return "Aguardando vendedor";
  if (status === "accepted") return "Aceito";
  return "Pendente";
}

function eventLabel(type: NegotiationMessage["type"]) {
  if (type === "initial_offer") return "Proposta inicial";
  if (type === "counter_offer") return "Contraproposta";
  if (type === "buyer_accepted") return "Comprador aceitou";
  if (type === "seller_accepted") return "Vendedor confirmou";
  if (type === "rejected") return "Negociação encerrada";
  if (type === "cancelled") return "Pedido cancelado";
  return "Atualização";
}
