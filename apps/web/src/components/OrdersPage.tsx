import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  CheckCircle2, 
  MessageCircle, 
  Package, 
  Truck, 
  XCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { formatBrl } from "../lib/format";
import { type OrderSummary, type OrderStatus, formatCardVariant } from "@poke-organizer/shared";
import { ConfirmationModal } from "./ui/ConfirmationModal";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onBack: () => void;
};

export function OrdersPage({ session, onSession, onUnauthorized, onBack }: Props) {
  const [tab, setTab] = useState<"sales" | "purchases">("sales");
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<{ id: string, status: "delivered" | "cancelled" } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await withAuthRetry(session, onSession, onUnauthorized, async (token) => {
        return tab === "sales" ? api.listMySales(token) : api.listMyPurchases(token);
      });
      setOrders(data);
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tab, session]);

  async function handleUpdateStatus(orderId: string, status: "delivered" | "cancelled") {
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateOrderStatus(token, orderId, status)
      );
      void load();
      setConfirming(null);
    } catch (err) {
      // Error is handled by api feedback
      setConfirming(null);
    }
  }

  function handleWhatsApp(order: OrderSummary) {
    const isSeller = tab === "sales";
    const phone = isSeller ? order.buyerWhatsapp : order.sellerWhatsapp;
    
    if (!phone) {
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const otherPartyName = isSeller ? order.buyerName : order.sellerName;
    const itemsList = order.items.map(item => {
        const number = item.cardNumber ? (item.cardTotal ? ` #${item.cardNumber}/${item.cardTotal}` : ` #${item.cardNumber}`) : '';
        const variant = item.variant && item.variant !== 'normal' ? ` [${formatCardVariant(item.variant)}]` : '';
        return `- ${item.quantity}x ${item.name}${number}${variant} (${formatBrl(item.price)})`;
    }).join('\n');
    
    let text = "";
    if (isSeller) {
        text = `Olá ${otherPartyName}! Sou o vendedor do Coleciona Cards sobre o pedido #${order.id.slice(-6)}.\n\n` +
               `*Itens do Pedido:*\n${itemsList}\n\n` +
               `*Total:* ${formatBrl(order.totalAmount)}\n\n` +
               `Podemos combinar o pagamento e o envio?`;
    } else {
        text = `Olá ${otherPartyName}! Sou o comprador do Coleciona Cards sobre o pedido #${order.id.slice(-6)}.\n\n` +
               `*Itens do Pedido:*\n${itemsList}\n\n` +
               `*Total:* ${formatBrl(order.totalAmount)}\n\n` +
               `Como podemos combinar o pagamento e o envio?`;
    }

    const message = encodeURIComponent(text);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-card-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground shadow-sm"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground">Meus Pedidos</h1>
            <p className="text-sm font-semibold text-muted-foreground">Acompanhe suas vendas e compras realizadas.</p>
          </div>
        </div>
      </div>

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
            <Panel key={order.id} className="p-0 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-card-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl sm:rounded-2xl ${
                    order.status === "delivered" ? "bg-leaf/10 text-leaf" :
                    order.status === "cancelled" ? "bg-magenta/10 text-magenta" :
                    "bg-amber/10 text-amber"
                  }`}>
                    {order.status === "delivered" ? <CheckCircle2 size={20} className="sm:w-6 sm:h-6" /> :
                     order.status === "cancelled" ? <XCircle size={20} className="sm:w-6 sm:h-6" /> :
                     <Clock size={20} className="sm:w-6 sm:h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground">Pedido #{order.id.slice(-6)}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                        order.status === "delivered" ? "bg-leaf text-white" :
                        order.status === "cancelled" ? "bg-magenta text-white" :
                        "bg-amber text-amber-950"
                      }`}>
                        {order.status === "delivered" ? "Entregue" : 
                         order.status === "cancelled" ? "Cancelado" : 
                         "Pendente"}
                      </span>
                    </div>
                    <h3 className="font-black text-foreground truncate">
                      {tab === "sales" ? `Comprador: ${order.buyerName}` : `Vendedor: ${order.sellerName}`}
                    </h3>
                  </div>
                </div>
                <div className="flex sm:block justify-between items-center sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-card-border/10">
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase">Total</p>
                  <p className="text-lg sm:text-xl font-black text-foreground">{formatBrl(order.totalAmount)}</p>
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-muted/20">
                <div className="grid gap-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="h-12 w-9 sm:h-16 sm:w-12 overflow-hidden rounded-lg bg-input border border-card-border/40 shadow-sm shrink-0">
                        <img src={item.imageSmall || ""} className="h-full w-full object-contain" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-foreground text-sm sm:text-base truncate">
                            {item.quantity}x {item.name}
                            {item.cardNumber && <span className="ml-2 text-[10px] text-muted-foreground">#{item.cardNumber}{item.cardTotal ? `/${item.cardTotal}` : ''}</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.condition && <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{item.condition}</span>}
                          {item.variant && <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{item.variant}</span>}
                        </div>
                      </div>
                      <p className="font-bold text-foreground text-sm sm:text-base">{formatBrl(item.price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-card-border/30">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <Button
                    variant="brand"
                    classChildren="flex flex-row gap-2"
                    className="h-11 px-6 gap-2 bg-leaf hover:bg-emerald-600 text-white border-none shadow-glow shadow-leaf/20 w-full sm:w-auto"
                    onClick={() => handleWhatsApp(order)}
                  >
                    <MessageCircle size={18} />
                    Conversar no WhatsApp
                  </Button>
                  
                  {order.auctionId && (
                     <a 
                       href={`/auctions/${order.auctionId}`} 
                       className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-black text-brand uppercase hover:underline py-2 sm:py-0"
                       target="_blank"
                       rel="noopener noreferrer"
                     >
                        <ExternalLink size={14} />
                        Ver Leilão
                     </a>
                  )}
                </div>

                {tab === "sales" && order.status === "pending" && (
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <button
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] sm:text-xs font-black text-magenta uppercase hover:bg-magenta/10 rounded-xl transition w-full sm:w-auto order-2 sm:order-1"
                      onClick={() => setConfirming({ id: order.id, status: "cancelled" })}
                    >
                      <XCircle size={16} />
                      Cancelar
                    </button>
                    <Button
                      variant="brand"
                      classChildren="flex flex-row gap-2"
                      className="h-11 px-6 w-full sm:w-auto order-1 sm:order-2"
                      onClick={() => setConfirming({ id: order.id, status: "delivered" })}
                    >
                      <Truck size={18} className="mr-2" />
                      Marcar como Entregue
                    </Button>
                  </div>
                )}
              </div>
            </Panel>
          ))
        )}
      </div>

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
