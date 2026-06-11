import { useEffect, useState } from "react";
import { ShoppingBag, ArrowRight, Trash2, FolderOpen } from "lucide-react";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { formatBrl } from "../lib/format";
import { type AppRoute } from "../pages/App";

type CartEntry = {
  shareToken: string;
  items: any[];
  totalItems: number;
  totalValue: number;
  isGlobalMode: boolean;
  globalTotal: string;
};

type Props = {
  onNavigate: (route: AppRoute) => void;
};

export function CartAreaPage({ onNavigate }: Props) {
  const [carts, setCarts] = useState<CartEntry[]>([]);

  useEffect(() => {
    const entries: CartEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("cart_") && !key.includes("_global_")) {
        try {
          const shareToken = key.replace("cart_", "");
          const cartStr = localStorage.getItem(key);
          if (!cartStr) continue;
          
          const cart = JSON.parse(cartStr);
          if (!cart || typeof cart !== 'object') continue;
          
          const items = Object.values(cart);
          
          const isGlobalMode = localStorage.getItem(`cart_global_mode_${shareToken}`) === "true";
          const globalTotal = localStorage.getItem(`cart_global_total_${shareToken}`) || "";

          if (items.length === 0 && !isGlobalMode) continue;

          const totalItems = items.reduce((sum: number, entry: any) => {
             const qty = Number(entry?.quantity) || 0;
             return sum + qty;
          }, 0);
          
          const totalValue = items.reduce((sum: number, entry: any) => {
             const price = Number(entry?.amount) || 0;
             const qty = Number(entry?.quantity) || 1;
             return sum + (price * qty);
          }, 0);

          entries.push({
            shareToken,
            items,
            totalItems,
            totalValue,
            isGlobalMode,
            globalTotal
          });
        } catch (err) {
          console.error("Failed to parse cart", err);
        }
      }
    }
    setCarts(entries.sort((a, b) => b.totalValue - a.totalValue));
  }, []);

  function removeCart(shareToken: string) {
    if (!window.confirm("Deseja mesmo excluir este carrinho salvo localmente?")) return;
    
    localStorage.removeItem(`cart_${shareToken}`);
    localStorage.removeItem(`cart_global_mode_${shareToken}`);
    localStorage.removeItem(`cart_global_total_${shareToken}`);
    
    setCarts(current => current.filter(c => c.shareToken !== shareToken));
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-foreground">Meus Carrinhos</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Carrinhos de propostas que você salvou no seu navegador.
          </p>
        </div>
      </div>

      {carts.length === 0 ? (
        <Panel>
          <div className="py-20 text-center">
            <ShoppingBag size={48} className="mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-lg font-bold text-muted-foreground">Nenhum carrinho salvo.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Adicione itens ao carrinho em coleções públicas para vê-los aqui.
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {carts.map((cart) => (
            <div key={cart.shareToken} className="glass-panel group overflow-hidden border border-card-border/40 hover:border-brand/40 transition-all">
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-200 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <FolderOpen size={12} />
                    {cart.shareToken.slice(0, 8)}...
                  </div>
                  <button 
                    onClick={() => removeCart(cart.shareToken)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Excluir carrinho"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-1 mb-6">
                  <p className="text-2xl font-black text-foreground">
                    {cart.isGlobalMode ? formatBrl(Number(cart.globalTotal) || 0) : formatBrl(cart.totalValue)}
                  </p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {cart.totalItems} {cart.totalItems === 1 ? 'carta' : 'cartas'} no carrinho
                    {cart.isGlobalMode && <span className="ml-1 text-brand">(Oferta Global)</span>}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                   {cart.items.slice(0, 4).map((entry, idx) => (
                     <div key={idx} className="h-12 w-9 rounded-md overflow-hidden bg-slate-200 dark:bg-white/5 border border-white/5">
                        <img src={entry.item.card.imageSmall} className="h-full w-full object-cover" alt={entry.item.card.name} />
                     </div>
                   ))}
                   {cart.items.length > 4 && (
                     <div className="h-12 w-9 rounded-md bg-slate-200 dark:bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-black text-muted-foreground">
                       +{cart.items.length - 4}
                     </div>
                   )}
                </div>

                <Button
                  variant="brand"
                  className="w-full h-12 gap-2"
                  onClick={() => onNavigate({ view: "home", publicCollection: cart.shareToken })}
                >
                  Ver Coleção <ArrowRight size={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
