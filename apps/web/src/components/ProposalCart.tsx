import { useState, useMemo, useEffect, useRef } from "react";
import { ShoppingBag, X, Plus, Minus, MessageSquare, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { CollectionItem, CollectionCartOffer } from "@poke-organizer/shared";
import { formatBrl } from "../lib/format";
import { Button } from "./ui/Button";

type CartItem = {
  item: CollectionItem;
  amount: string;
  quantity: number;
};

type Props = {
  cart: Record<string, CartItem>;
  setCart: React.Dispatch<React.SetStateAction<Record<string, CartItem>>>;
  isGlobalMode: boolean;
  setIsGlobalMode: (val: boolean) => void;
  globalTotal: string;
  setGlobalTotal: (val: string) => void;
  onSubmit: (proposalItems: { folderItemId: string; amount: number; quantity: number }[], message: string, totalOffer?: number, isGlobalOffer?: boolean) => Promise<void>;
  isSubmitting: boolean;
  folderName: string;
  session: any;
  theme?: "light" | "dark";
};

export function ProposalCart({ 
  cart, 
  setCart, 
  isGlobalMode, 
  setIsGlobalMode, 
  globalTotal, 
  setGlobalTotal, 
  onSubmit, 
  isSubmitting, 
  folderName, 
  session, 
  theme 
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [hasNewItems, setHasNewItems] = useState(false);
  const prevCartLength = useRef(Object.keys(cart).length);

  const cartList = Object.values(cart);
  const totalItems = cartList.reduce((sum, item) => sum + item.quantity, 0);
  const calculatedTotal = cartList.reduce((sum, entry) => sum + (Number(entry.amount) || 0) * entry.quantity, 0);
  const displayTotal = isGlobalMode && globalTotal ? Number(globalTotal) : calculatedTotal;

  useEffect(() => {
    if (cartList.length > prevCartLength.current && !isExpanded) {
      setHasNewItems(true);
    }
    prevCartLength.current = cartList.length;
  }, [cartList.length, isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      setHasNewItems(false);
    }
  }, [isExpanded]);

  if (cartList.length === 0) return null;

  function updateQuantity(id: string, delta: number) {
    setCart(prev => {
      const entry = prev[id];
      if (!entry) return prev;
      const nextQuantity = Math.max(1, Math.min(entry.item.quantity, entry.quantity + delta));
      return {
        ...prev,
        [id]: { ...entry, quantity: nextQuantity }
      };
    });
  }

  function updateAmount(id: string, amount: string) {
    setCart(prev => {
      const entry = prev[id];
      if (!entry) return prev;
      return {
        ...prev,
        [id]: { ...entry, amount }
      };
    });
  }

  function removeFromCart(id: string) {
    setCart(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleFinalize() {
    if (!session) {
       window.location.href = `/?redirect=${encodeURIComponent(window.location.href)}`;
       return;
    }

    const proposalItems = cartList.map((entry) => ({
      folderItemId: entry.item.folderItemId!,
      amount: Number(entry.amount),
      quantity: entry.quantity,
    })).filter(i => i.amount >= 0);

    if (proposalItems.length === 0) return;

    setError(null);
    try {
      await onSubmit(
        proposalItems, 
        message, 
        isGlobalMode ? Number(globalTotal) : Number(calculatedTotal.toFixed(2)),
        isGlobalMode
      );
      setCart({});
      setIsExpanded(false);
      setMessage("");
      setGlobalTotal("");
      setIsGlobalMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao enviar proposta");
    }
  }

  return (
    <>
      {/* Mobile Overlay - Only when expanded */}
      <div 
        className={`fixed inset-0 z-[25] bg-background/60 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${
          isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsExpanded(false)}
      />

      <div className={`fixed z-[30] transition-all duration-500 ease-in-out flex flex-col items-end
        ${isExpanded 
          ? "inset-x-0 bottom-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-auto" 
          : "bottom-0 left-0 right-0 h-16 sm:bottom-6 sm:right-6 sm:left-auto sm:w-auto sm:rounded-full"
        }
      `}>
        {/* Main Container */}
        <div className={`relative flex flex-col w-full transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.3)]
          ${isExpanded
            ? "h-[600px] max-h-[90vh] sm:max-h-[80vh] rounded-t-[32px] sm:rounded-[32px] bg-card backdrop-blur-xl border-t sm:border border-card-border/40 overflow-hidden"
            : "h-16 bg-card/95 backdrop-blur-md border-t sm:border border-card-border/40 sm:rounded-full sm:w-auto overflow-visible"
          }
          ${isGlobalMode && isExpanded ? "border-t-2 border-brand sm:border-t" : ""}
        `}>
          
          {/* Header Area / Minimized State */}
          <div 
            className={`flex shrink-0 items-center justify-between transition-all duration-300 cursor-pointer ${
              isExpanded 
                ? "border-b border-card-border/20 bg-gradient-to-r from-brand/10 to-magenta/10 p-5" 
                : "h-full px-5 sm:px-2 sm:pr-6"
            }`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* Expanded Header or Mobile Minimized Header */}
            <div className={`flex relative items-center gap-3 ${!isExpanded && "hidden sm:hidden"} ${isExpanded && "flex"} w-full sm:w-auto`}>
              <div className="">
                <div className={`grid h-10 w-10 place-items-center rounded-2xl shadow-glow transition-colors ${isGlobalMode ? "bg-brand text-white" : "bg-card text-foreground border border-card-border/40"}`}>
                  <ShoppingBag size={20} />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-foreground truncate">Carrinho: {folderName}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                  Finalize sua proposta
                </p>
              </div>
            </div>

            {/* Desktop Bubble Content (Only visible when NOT expanded) */}
            {!isExpanded && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="relative">
                  <div className={`grid h-12 w-12 place-items-center rounded-full transition-all duration-300 ${
                    hasNewItems 
                      ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-110" 
                      : "bg-brand shadow-glow"
                  }`}>
                    <ShoppingBag size={24} className="text-white" />
                  </div>
                  {totalItems > 0 && hasNewItems && (
                    <span className="absolute -left-1 -top-1 grid h-6 w-6 place-items-center rounded-full text-xs font-black text-white bg-rose-500 ring-4 ring-background animate-soft-pop">
                      {totalItems}
                    </span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-0.5">Total Carrinho</p>
                  <p className="text-xs font-black text-foreground">{totalItems} itens • {formatBrl(displayTotal)}</p>
                </div>
              </div>
            )}

            {/* Mobile Bar Content (Only visible when NOT expanded) */}
            {!isExpanded && (
              <div className="flex sm:hidden w-full items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`grid h-10 w-10 place-items-center rounded-2xl text-white shadow-glow transition-all duration-300 ${
                      hasNewItems ? "bg-rose-500" : "bg-brand"
                    }`}>
                      <ShoppingBag size={20} />
                    </div>
                    {hasNewItems && (
                      <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[8px] font-black text-rose-500 ring-2 ring-rose-500 animate-pulse">
                        {totalItems}
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none">Total Carrinho</p>
                    <p className="text-sm font-black text-foreground">{totalItems} itens • {formatBrl(displayTotal)}</p>
                  </div>
                </div>
                <ChevronUp className="text-muted-foreground" size={20} />
              </div>
            )}

            {/* Expanded Close Controls */}
            {isExpanded && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className="p-2 text-muted-foreground hover:text-rose-500 transition-colors"
                >
                  <ChevronDown className="sm:hidden" size={24} />
                  <X className="hidden sm:block" size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Expanded Content View */}
          <div className={`flex-1 overflow-y-auto p-5 scrollbar-hide transition-all duration-500 ${isExpanded ? "opacity-100" : "opacity-0 pointer-events-none h-0"}`}>
            <div className="space-y-4">
              {cartList.map((entry) => {
                const originalPrice = entry.item.store?.effectivePrice ?? entry.item.price?.amount ?? 0;
                return (
                  <div key={entry.item.id} className="group relative flex flex-col gap-3 rounded-2xl border border-card-border/40 bg-muted/30 p-3 transition hover:border-card-border/60">
                    <div className="flex items-center gap-3">
                      <img 
                        src={entry.item.card.imageSmall ?? ""} 
                        alt="" 
                        className="h-16 w-12 rounded-lg object-cover shadow-md"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-black text-foreground">{entry.item.card.name}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground">
                            Ref: {formatBrl(originalPrice)}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFromCart(entry.item.id); }}
                        className="p-2 text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black transition-colors ${isGlobalMode ? "text-muted-foreground/40" : "text-muted-foreground"}`}>R$</span>
                        <input 
                          className={`w-full h-10 rounded-xl border border-card-border/40 bg-input px-8 text-sm font-black outline-none transition-all ${
                            isGlobalMode 
                              ? "opacity-50 cursor-not-allowed border-transparent" 
                              : "text-foreground focus:ring-2 focus:ring-cyan/50"
                          }`}
                          type="number"
                          step="0.01"
                          value={isGlobalMode ? originalPrice.toFixed(2) : entry.amount}
                          onChange={(e) => updateAmount(entry.item.id, e.target.value)}
                          disabled={isGlobalMode}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-xl border border-card-border/40 bg-input p-1" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => updateQuantity(entry.item.id, -1)}
                          className="p-1.5 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-foreground">{entry.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(entry.item.id, 1)}
                          className="p-1.5 text-muted-foreground hover:bg-accent rounded-lg transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="mt-6 space-y-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsGlobalMode(!isGlobalMode);
                    if (!isGlobalMode) setGlobalTotal(calculatedTotal.toFixed(2));
                  }}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 transition-all text-left ${
                    isGlobalMode 
                      ? "border-brand bg-brand/5 shadow-[0_0_20px_rgba(var(--color-brand),0.1)]" 
                      : "border-card-border/40 bg-muted/20 hover:border-card-border/60 hover:bg-muted/30"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                    isGlobalMode 
                      ? "border-brand bg-brand text-white" 
                      : "border-muted-foreground/30 bg-transparent"
                  }`}>
                    {isGlobalMode && <Check size={16} strokeWidth={4} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black transition-colors ${isGlobalMode ? "text-brand" : "text-foreground"}`}>
                        Definir valor final para a proposta
                      </p>
                      {isGlobalMode && (
                        <span className="rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-black uppercase text-white animate-pulse">Ativo</span>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-muted-foreground">Substitui a soma individual por um valor único no carrinho</p>
                  </div>
                </button>

                {isGlobalMode && (
                  <div className="relative animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-brand/60">R$</span>
                    <input 
                      className="w-full h-14 rounded-2xl border-2 border-brand bg-brand/5 pl-12 text-xl font-black text-brand outline-none focus:ring-4 focus:ring-brand/10 transition-all"
                      type="number"
                      step="0.01"
                      value={globalTotal}
                      onChange={(e) => setGlobalTotal(e.target.value)}
                      placeholder="0,00"
                      autoFocus
                    />
                  </div>
                )}

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <MessageSquare className="absolute left-4 top-4 text-muted-foreground" size={18} />
                  <textarea 
                    className="w-full min-h-[100px] rounded-2xl border border-card-border/40 bg-input p-4 pl-12 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder="Adicione uma mensagem (opcional)..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Footer Area */}
          <div className={`border-t border-card-border/30 bg-muted/50 p-5 backdrop-blur-md transition-all duration-500 ${isExpanded ? "opacity-100" : "opacity-0 pointer-events-none h-0 p-0"}`}>
            <div className="mb-4 flex items-center justify-between px-1">
              <span className="text-sm font-black text-muted-foreground uppercase tracking-widest">Total da Proposta</span>
              <span className={`text-2xl font-black transition-colors ${isGlobalMode ? "text-brand" : "text-foreground"}`}>
                {formatBrl(displayTotal)}
              </span>
            </div>
            {error && <p className="mb-4 text-[10px] font-bold text-rose-500 text-center">{error}</p>}
            <Button 
              className="w-full h-14 text-base shadow-glow"
              variant="brand"
              disabled={isSubmitting || cartList.length === 0}
              onClick={(e) => { e.stopPropagation(); handleFinalize(); }}
            >
              {isSubmitting ? "Enviando..." : (session ? "Finalizar Proposta" : "Fazer Login para Enviar")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
