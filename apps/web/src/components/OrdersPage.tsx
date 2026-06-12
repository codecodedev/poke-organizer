import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageCircle,
  Package,
  Send,
  Truck,
  XCircle,
} from "lucide-react";
import {
  formatCardVariant,
  type OrderDetail,
  type OrderSummary,
} from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { formatBrl } from "../lib/format";
import { createOrderSocket, type OrderSocket } from "../lib/orderSocket";
import { Button } from "./ui/Button";
import { ConfirmationModal } from "./ui/ConfirmationModal";
import { Panel } from "./ui/Panel";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onBack: () => void;
  initialOrderId?: string | null;
  onOrderRouteChange?: (orderId: string | null) => void;
};

type Tab = "sales" | "purchases";

export function OrdersPage({
  session,
  onSession,
  onUnauthorized,
  onBack,
  initialOrderId,
  onOrderRouteChange,
}: Props) {
  const [tab, setTab] = useState<Tab>("sales");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId ?? null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [confirming, setConfirming] = useState<{ id: string; status: "delivered" | "cancelled" } | null>(null);
  const socketRef = useRef<OrderSocket | null>(null);

  const isDetail = Boolean(selectedOrderId);

  async function load() {
    setLoading(true);
    try {
      const data = await withAuthRetry(session, onSession, onUnauthorized, async (token) =>
        tab === "sales" ? api.listMySales(token) : api.listMyPurchases(token),
      );
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }

  const loadDetail = useCallback(async (
    orderId: string,
    options: { showLoading?: boolean; clearOnError?: boolean } = {},
  ) => {
    const { showLoading = true, clearOnError = true } = options;
    if (showLoading) {
      setDetailLoading(true);
    }
    try {
      const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.getOrder(token, orderId),
      );
      setSelectedOrder(detail);
      setTab(detail.sellerId === session.user.id ? "sales" : "purchases");
    } catch (err) {
      console.error("Failed to load order detail", err);
      if (clearOnError) {
        setSelectedOrderId(null);
        onOrderRouteChange?.(null);
      }
    } finally {
      if (showLoading) {
        setDetailLoading(false);
      }
    }
  }, [onOrderRouteChange, onSession, onUnauthorized, session]);

  useEffect(() => {
    setSelectedOrderId(initialOrderId ?? null);
  }, [initialOrderId]);

  useEffect(() => {
    void load();
  }, [tab, session]);

  useEffect(() => {
    if (selectedOrderId) {
      void loadDetail(selectedOrderId);
    } else {
      setSelectedOrder(null);
    }
  }, [loadDetail, selectedOrderId]);

  useEffect(() => {
    if (!selectedOrderId) return;

    const socket = createOrderSocket(session.accessToken);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("order:join", { orderId: selectedOrderId });
    });
    socket.on("order:detail", (detail) => {
      if (detail.id !== selectedOrderId) return;
      setSelectedOrder(detail);
      setTab(detail.sellerId === session.user.id ? "sales" : "purchases");
    });
    socket.on("order:error", (payload) => {
      console.error("Order socket error", payload.message);
    });

    socket.connect();

    return () => {
      if (socket.connected) {
        socket.emit("order:leave", { orderId: selectedOrderId });
      }
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, [selectedOrderId, session.accessToken, session.user.id]);

  async function handleUpdateStatus(orderId: string, status: "delivered" | "cancelled") {
    try {
      const updated = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateOrderStatus(token, orderId, status),
      );
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      if (selectedOrder?.id === updated.id) {
        await loadDetail(updated.id);
      }
      setConfirming(null);
    } catch {
      setConfirming(null);
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedOrder || !message.trim()) return;

    setSendingMessage(true);
    try {
      const detail = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.sendOrderMessage(token, selectedOrder.id, message),
      );
      setSelectedOrder(detail);
      setMessage("");
    } finally {
      setSendingMessage(false);
    }
  }

  function openDetail(orderId: string) {
    setSelectedOrderId(orderId);
    onOrderRouteChange?.(orderId);
  }

  function closeDetail() {
    setSelectedOrderId(null);
    setSelectedOrder(null);
    onOrderRouteChange?.(null);
  }

  const title = isDetail ? `Pedido #${selectedOrderId?.slice(-6).toUpperCase()}` : "Meus Pedidos";

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
              {isDetail ? "Negocie e acompanhe este pedido dentro da plataforma." : "Acompanhe suas vendas e compras realizadas."}
            </p>
          </div>
        </div>
      </div>

      {isDetail ? (
        <OrderDetailView
          currentUserId={session.user.id}
          order={selectedOrder}
          loading={detailLoading}
          message={message}
          sendingMessage={sendingMessage}
          onMessageChange={setMessage}
          onSendMessage={handleSendMessage}
          onConfirmDelivered={(id) => setConfirming({ id, status: "delivered" })}
          onConfirmCancelled={(id) => setConfirming({ id, status: "cancelled" })}
        />
      ) : (
        <>
          <div className="flex gap-2 p-1 bg-muted rounded-2xl w-fit">
            <button
              onClick={() => setTab("sales")}
              className={`px-6 py-2 rounded-xl text-sm font-black transition ${tab === "sales" ? "bg-card shadow-sm text-brand" : "text-muted-foreground hover:text-foreground"}`}
            >
              Minhas Vendas
            </button>
            <button
              onClick={() => setTab("purchases")}
              className={`px-6 py-2 rounded-xl text-sm font-black transition ${tab === "purchases" ? "bg-card shadow-sm text-brand" : "text-muted-foreground hover:text-foreground"}`}
            >
              Minhas Compras
            </button>
          </div>

          <div className="grid gap-6">
            {loading ? (
              <div className="py-24 text-center font-black text-muted-foreground animate-pulse">Carregando pedidos...</div>
            ) : orders.length === 0 ? (
              <div className="py-24 text-center bg-card rounded-[32px] border border-card-border border-dashed">
                <Package size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-sm font-bold text-muted-foreground">Nenhum pedido encontrado.</p>
              </div>
            ) : (
              orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  tab={tab}
                  onOpenDetail={() => openDetail(order.id)}
                />
              ))
            )}
          </div>
        </>
      )}

      {confirming && (
        <ConfirmationModal
          title={confirming.status === "delivered" ? "Confirmar Entrega" : "Confirmar Cancelamento"}
          description={confirming.status === "delivered"
            ? "Ao marcar como entregue, as cartas vinculadas a este pedido serão automaticamente removidas do seu inventário. Deseja continuar?"
            : "Tem certeza que deseja cancelar este pedido? Esta ação não pode ser desfeita."}
          confirmLabel={confirming.status === "delivered" ? "Sim, marcar como entregue" : "Sim, cancelar pedido"}
          cancelLabel="Voltar"
          confirmVariant={confirming.status === "delivered" ? "brand" : "ghost"}
          onConfirm={() => handleUpdateStatus(confirming.id, confirming.status)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

function OrderCard({ order, tab, onOpenDetail }: { order: OrderSummary; tab: Tab; onOpenDetail: () => void }) {
  const isSeller = tab === "sales";

  return (
    <Panel className="p-0 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-card-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <StatusIcon status={order.status} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">Pedido #{order.id.slice(-6)}</span>
              <StatusBadge status={order.status} />
            </div>
            <h3 className="font-black text-foreground truncate">
              {isSeller ? `Comprador: ${order.buyerName}` : `Vendedor: ${order.sellerName}`}
            </h3>
          </div>
        </div>
        <div className="flex sm:block justify-between items-center sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-card-border/10">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">Total</p>
          <p className="text-lg sm:text-xl font-black text-foreground">{formatBrl(order.totalAmount)}</p>
        </div>
      </div>

      <OrderItems items={order.items} compact />

      <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-card-border/30">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            variant="brand"
            classChildren="flex flex-row gap-2"
            className="h-11 px-6 gap-2 bg-leaf hover:bg-emerald-600 text-white border-none shadow-glow shadow-leaf/20 w-full sm:w-auto"
            onClick={onOpenDetail}
          >
            <MessageCircle size={18} />
            {isSeller ? "Falar com comprador" : "Falar com vendedor"}
          </Button>
          <Button
            variant="ghost"
            className="h-11 px-6 w-full sm:w-auto"
            onClick={onOpenDetail}
          >
            Ver detalhes
          </Button>
          {order.auctionId && (
            <a
              href={`/auctions/${order.auctionId}`}
              className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-black text-brand uppercase hover:underline py-2 sm:py-0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={14} />
              Ver negociação
            </a>
          )}
        </div>
      </div>
    </Panel>
  );
}

function OrderDetailView({
  currentUserId,
  order,
  loading,
  message,
  sendingMessage,
  onMessageChange,
  onSendMessage,
  onConfirmDelivered,
  onConfirmCancelled,
}: {
  currentUserId: string;
  order: OrderDetail | null;
  loading: boolean;
  message: string;
  sendingMessage: boolean;
  onMessageChange: (value: string) => void;
  onSendMessage: (event: FormEvent) => void;
  onConfirmDelivered: (id: string) => void;
  onConfirmCancelled: (id: string) => void;
}) {
  const isSeller = order?.sellerId === currentUserId;
  const otherParty = isSeller ? order?.buyerName : order?.sellerName;
  const canUpdateStatus = isSeller && order?.status === "pending";
  const sortedMessages = useMemo(() => order?.messages ?? [], [order?.messages]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [sortedMessages.length]);

  if (loading || !order) {
    return <div className="py-24 text-center font-black text-muted-foreground animate-pulse">Carregando pedido...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <Panel className="p-0 overflow-hidden">
          <div className="p-5 border-b border-card-border/30 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <StatusIcon status={order.status} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {isSeller ? `Comprador: ${otherParty}` : `Vendedor: ${otherParty}`}
                  </span>
                </div>
                <p className="text-2xl font-black text-foreground">{formatBrl(order.totalAmount)}</p>
              </div>
            </div>
            {canUpdateStatus && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-black text-magenta uppercase hover:bg-magenta/10 rounded-xl transition"
                  onClick={() => onConfirmCancelled(order.id)}
                >
                  <XCircle size={16} />
                  Cancelar
                </button>
                <Button
                  variant="brand"
                  classChildren="flex flex-row gap-2"
                  className="h-11 px-6"
                  onClick={() => onConfirmDelivered(order.id)}
                >
                  <Truck size={18} />
                  Marcar como entregue
                </Button>
              </div>
            )}
          </div>
          <OrderItems items={order.items} />
        </Panel>
      </div>

      <Panel title="Conversa do pedido" description="Negocie os detalhes finais sem expor dados de contato.">
        <div className="flex h-[560px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-card-border/40 bg-background/40 p-3">
            {sortedMessages.length === 0 ? (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <MessageCircle size={36} className="mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm font-bold text-muted-foreground">Nenhuma mensagem ainda.</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">A primeira mensagem notifica {otherParty} por e-mail.</p>
                </div>
              </div>
            ) : (
              sortedMessages.map((chatMessage) => {
                const mine = chatMessage.senderId === currentUserId;
                return (
                  <div key={chatMessage.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${mine ? "bg-brand text-white" : "bg-card border border-card-border text-foreground"}`}>
                      <p className={`mb-1 text-[10px] font-black uppercase tracking-widest ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                        {mine ? "Você" : chatMessage.senderName}
                      </p>
                      <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed">{chatMessage.message}</p>
                      <p className={`mt-2 text-[10px] font-bold ${mine ? "text-white/60" : "text-muted-foreground"}`}>
                        {new Date(chatMessage.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={onSendMessage} className="mt-3 flex gap-2">
            <textarea
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              placeholder="Escreva sua mensagem..."
              className="min-h-14 flex-1 resize-none rounded-2xl border border-card-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-brand/30"
              maxLength={2000}
            />
            <Button
              type="submit"
              variant="brand"
              className="h-14 px-5"
              disabled={sendingMessage || !message.trim()}
            >
              <Send size={18} />
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}

function OrderItems({ items, compact = false }: { items: OrderSummary["items"]; compact?: boolean }) {
  const displayItems = compact ? items.slice(0, 10) : items;
  const hasMore = compact && items.length > 10;

  return (
    <div className={`${compact ? "p-4 sm:p-6 bg-muted/20" : "p-5"}`}>
      <div className="grid gap-4">
        {displayItems.map((item) => (
          <div key={item.id} className="flex items-center gap-4">
            {!compact && (
              <div className="h-12 w-9 sm:h-16 sm:w-12 overflow-hidden rounded-lg bg-input border border-card-border/40 shadow-sm shrink-0">
                <img src={item.imageSmall || ""} className="h-full w-full object-contain" alt="" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-black text-foreground text-sm sm:text-base truncate">
                <span className="text-brand mr-1">{item.quantity}x</span> {item.name}
                {item.cardNumber && <span className="ml-2 text-[10px] text-muted-foreground">#{item.cardNumber}{item.cardTotal ? `/${item.cardTotal}` : ""}</span>}
              </p>
              {!compact && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {item.condition && <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{item.condition}</span>}
                  {item.variant && item.variant !== "normal" && <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{formatCardVariant(item.variant)}</span>}
                  {item.language && <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{item.language}</span>}
                </div>
              )}
            </div>
            {!compact && <p className="font-bold text-foreground text-sm sm:text-base">{formatBrl(item.price)}</p>}
          </div>
        ))}
        {hasMore && (
          <div className="text-[10px] font-black text-brand uppercase tracking-widest pt-2">
            + {items.length - 10} cartas (Ver detalhes do pedido)
          </div>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: OrderSummary["status"] }) {
  return (
    <div className={`grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl sm:rounded-2xl ${
      status === "delivered" ? "bg-leaf/10 text-leaf" :
      status === "cancelled" ? "bg-magenta/10 text-magenta" :
      "bg-amber/10 text-amber"
    }`}>
      {status === "delivered" ? <CheckCircle2 size={20} className="sm:w-6 sm:h-6" /> :
       status === "cancelled" ? <XCircle size={20} className="sm:w-6 sm:h-6" /> :
       <Clock size={20} className="sm:w-6 sm:h-6" />}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderSummary["status"] }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
      status === "delivered" ? "bg-leaf text-white" :
      status === "cancelled" ? "bg-magenta text-white" :
      "bg-amber text-amber-950"
    }`}>
      {status === "delivered" ? "Entregue" : status === "cancelled" ? "Cancelado" : "Pendente"}
    </span>
  );
}
