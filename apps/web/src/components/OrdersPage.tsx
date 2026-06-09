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
import type { OrderSummary, OrderStatus } from "@poke-organizer/shared";
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

  function handleWhatsApp(phone: string | null | undefined, orderId: string) {
    if (!phone) {
      // In a real app we'd use a Toast or another Modal, but for now we follow the "no alert" rule
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá! Estou entrando em contato sobre o pedido #${orderId} no Coleciona Cards.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-white text-slate-700 transition hover:bg-field shadow-sm dark:bg-black/20 dark:text-white dark:border-white/10"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-ink dark:text-white">Meus Pedidos</h1>
            <p className="text-sm font-semibold text-slate-500">Acompanhe suas vendas e compras realizadas.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit dark:bg-white/5">
        <button
          onClick={() => setTab("sales")}
          className={`px-6 py-2 rounded-xl text-sm font-black transition ${tab === "sales" ? "bg-white shadow-sm text-brand dark:bg-zinc-800 dark:text-white" : "text-slate-500"}`}
        >
          Minhas Vendas
        </button>
        <button
          onClick={() => setTab("purchases")}
          className={`px-6 py-2 rounded-xl text-sm font-black transition ${tab === "purchases" ? "bg-white shadow-sm text-brand dark:bg-zinc-800 dark:text-white" : "text-slate-500"}`}
        >
          Minhas Compras
        </button>
      </div>

      <div className="grid gap-6">
        {loading ? (
          <div className="py-24 text-center font-black text-slate-400 animate-pulse">Carregando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-[32px] border border-line border-dashed dark:bg-transparent dark:border-white/10">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-sm font-bold text-slate-400">Nenhum pedido encontrado.</p>
          </div>
        ) : (
          orders.map((order) => (
            <Panel key={order.id} className="p-0 overflow-hidden dark:bg-black/20 dark:border-white/5">
              <div className="p-4 sm:p-6 border-b border-line/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`grid h-10 w-10 sm:h-12 sm:w-12 place-items-center rounded-xl sm:rounded-2xl ${
                    order.status === "delivered" ? "bg-leaf/10 text-leaf" :
                    order.status === "cancelled" ? "bg-red-50 text-red-500" :
                    "bg-amber-50 text-amber-600"
                  }`}>
                    {order.status === "delivered" ? <CheckCircle2 size={20} className="sm:w-6 sm:h-6" /> :
                     order.status === "cancelled" ? <XCircle size={20} className="sm:w-6 sm:h-6" /> :
                     <Clock size={20} className="sm:w-6 sm:h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400">Pedido #{order.id.slice(-6)}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                        order.status === "delivered" ? "bg-leaf text-white" :
                        order.status === "cancelled" ? "bg-red-500 text-white" :
                        "bg-amber-400 text-amber-950"
                      }`}>
                        {order.status === "delivered" ? "Entregue" : 
                         order.status === "cancelled" ? "Cancelado" : 
                         "Pendente"}
                      </span>
                    </div>
                    <h3 className="font-black text-ink dark:text-white truncate">
                      {tab === "sales" ? `Comprador: ${order.buyerName}` : `Vendedor: ${order.sellerName}`}
                    </h3>
                  </div>
                </div>
                <div className="flex sm:block justify-between items-center sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-line/10">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase">Total</p>
                  <p className="text-lg sm:text-xl font-black text-ink dark:text-white">{formatBrl(order.totalAmount)}</p>
                </div>
              </div>

              <div className="p-4 sm:p-6 bg-field/30 dark:bg-white/5">
                <div className="grid gap-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="h-12 w-9 sm:h-16 sm:w-12 overflow-hidden rounded-lg bg-white border border-line shadow-sm shrink-0">
                        <img src={item.imageSmall || ""} className="h-full w-full object-contain" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-ink text-sm sm:text-base truncate dark:text-white">{item.quantity}x {item.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.condition && <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{item.condition}</span>}
                          {item.variant && <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase">{item.variant}</span>}
                        </div>
                      </div>
                      <p className="font-bold text-slate-600 text-sm sm:text-base dark:text-slate-400">{formatBrl(item.price)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-line/40">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <Button
                    variant="brand"
                    className="h-11 px-6 gap-2 bg-emerald-500 hover:bg-emerald-400 text-white border-none shadow-glow shadow-emerald-500/20 w-full sm:w-auto"
                    onClick={() => handleWhatsApp(tab === "sales" ? order.buyerWhatsapp : order.sellerWhatsapp, order.id)}
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
                      className="flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] sm:text-xs font-black text-red-500 uppercase hover:bg-red-50 rounded-xl transition dark:hover:bg-red-500/10 w-full sm:w-auto order-2 sm:order-1"
                      onClick={() => setConfirming({ id: order.id, status: "cancelled" })}
                    >
                      <XCircle size={16} />
                      Cancelar
                    </button>
                    <Button
                      variant="brand"
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
