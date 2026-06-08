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
  onSubmit: (proposalItems: { folderItemId: string; amount: number; quantity: number }[], message: string, totalOffer?: number, isGlobalOffer?: boolean) => Promise<void>;
  isSubmitting: boolean;
  folderName: string;
  session: any;
  theme?: "light" | "dark";
};

export function ProposalCart({ cart, setCart, onSubmit, isSubmitting, folderName, session, theme }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [globalTotal, setGlobalTotal] = useState<string>("");
  const [isGlobalMode, setIsGlobalMode] = useState(false);
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
        isGlobalMode ? Number(globalTotal) : calculatedTotal,
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
        className={`fixed inset-0 z-[20] bg-black/60 backdrop-blur-sm transition-opacity duration-300 sm:hidden ${
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
        <div className={`relative flex flex-col w-full transition-all duration-300 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]
          ${isExpanded
            ? "h-[600px] max-h-[90vh] sm:max-h-[80vh] rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-zinc-950 backdrop-blur-xl border-t sm:border border-white/10"
            : "h-16 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t sm:border border-white/10 sm:rounded-full sm:w-auto"
          }
          ${isGlobalMode && isExpanded ? "border-t-2 border-brand sm:border-t" : ""}
        `}>
          
          {/* Header Area / Minimized State */}
          <div 
            className={`flex shrink-0 items-center justify-between transition-all duration-300 cursor-pointer ${
              isExpanded 
                ? "border-b border-white/5 bg-gradient-to-r from-brand/10 to-coral/10 p-5" 
                : "h-full px-5 sm:px-2 sm:pr-6"
            }`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {/* Expanded Header or Mobile Minimized Header */}
            <div className={`flex items-center gap-3 ${!isExpanded && "hidden sm:hidden"} ${isExpanded && "flex"} w-full sm:w-auto`}>
              <div className="relative">
                <div className={`grid h-10 w-10 place-items-center rounded-2xl text-white keep-white shadow-glow transition-colors ${isGlobalMode ? "bg-brand" : "bg-brand sm:bg-ink sm:dark:bg-white sm:dark:text-ink"}`}>
                  <ShoppingBag size={20} />
                </div>
                <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-magenta text-[10px] font-black text-white keep-white ring-2 ring-white dark:ring-black">
                  {totalItems}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-ink dark:text-white truncate">Carrinho: {folderName}</h3>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                  Finalize sua proposta
                </p>
              </div>
            </div>

            {/* Desktop Bubble Content (Only visible when NOT expanded) */}
            {!isExpanded && (
              <div className="hidden sm:flex items-center gap-3">
                <div className={`grid h-12 w-12 place-items-center rounded-full transition-all duration-300 ${
                  hasNewItems 
                    ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] scale-110" 
                    : "bg-brand shadow-glow"
                }`}>
                  <ShoppingBag size={24} className="text-white keep-white" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none mb-0.5">Total Carrinho</p>
                  <p className="text-xs font-black text-ink dark:text-white">{totalItems} itens • {formatBrl(displayTotal)}</p>
                </div>
                {totalItems > 0 && hasNewItems && (
                  <span className="absolute -left-1 -top-1 grid h-6 w-6 place-items-center rounded-full text-xs font-black text-white bg-rose-500 ring-4 ring-white dark:ring-zinc-900 animate-soft-pop keep-white">
                    {totalItems}
                  </span>
                )}
              </div>
            )}

            {/* Mobile Bar Content (Only visible when NOT expanded) */}
            {!isExpanded && (
              <div className="flex sm:hidden w-full items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`grid h-10 w-10 place-items-center rounded-2xl text-white keep-white shadow-glow transition-all duration-300 ${
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
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none">Total Carrinho</p>
                    <p className="text-sm font-black text-ink dark:text-white">{totalItems} itens • {formatBrl(displayTotal)}</p>
                  </div>
                </div>
                <ChevronUp className="text-slate-400 dark:text-white/60" size={20} />
              </div>
            )}

            {/* Expanded Close Controls */}
            {isExpanded && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                  className="p-2 text-slate-400 hover:text-rose-500 transition-colors dark:text-white/60 dark:hover:text-rose-400"
                >
                  <ChevronDown className="sm:hidden" size={24} />
                  <X className="hidden sm:block" size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Expanded Content View */}
          <div className={`flex-1 overflow-y-auto p-5 scrollbar-hide transition-opacity duration-300 ${isExpanded ? "opacity-100 delay-150" : "opacity-0 pointer-events-none"}`}>
            <div className="space-y-4">
              {cartList.map((entry) => {
                const originalPrice = entry.item.store?.effectivePrice ?? entry.item.price?.amount ?? 0;
                return (
                  <div key={entry.item.id} className="group relative flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/50 p-3 transition hover:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <img 
                        src={entry.item.card.imageSmall ?? ""} 
                        alt="" 
                        className="h-16 w-12 rounded-lg object-cover shadow-md"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-black text-ink dark:text-white">{entry.item.card.name}</h4>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            Ref: {formatBrl(originalPrice)}
                        </p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFromCart(entry.item.id); }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 dark:text-slate-600 dark:hover:text-rose-400"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] items-center gap-4">
                      <div className="relative">
                        <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black transition-colors ${isGlobalMode ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-500"}`}>R$</span>
                        <input 
                          className={`w-full h-10 rounded-xl border border-white/10 bg-white px-8 text-sm font-black outline-none transition-all ${
                            isGlobalMode 
                              ? "bg-slate-50 text-slate-300 cursor-not-allowed border-transparent dark:bg-zinc-800/50 dark:text-zinc-600" 
                              : "text-ink focus:ring-2 focus:ring-brand/20 dark:bg-zinc-900 dark:text-white dark:border-white/5"
                          }`}
                          type="number"
                          value={isGlobalMode ? originalPrice : entry.amount}
                          onChange={(e) => updateAmount(entry.item.id, e.target.value)}
                          disabled={isGlobalMode}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white p-1 dark:bg-zinc-900 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => updateQuantity(entry.item.id, -1)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:bg-white/10"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-black text-ink dark:text-white">{entry.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(entry.item.id, 1)}
                          className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:bg-white/10"
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
                    if (!isGlobalMode) setGlobalTotal(String(calculatedTotal));
                  }}
                  className={`flex w-full items-center gap-4 rounded-2xl border p-4 transition-all text-left ${
                    isGlobalMode 
                      ? "border-brand bg-brand/5 shadow-[0_0_20px_rgba(var(--brand-rgb),0.1)]" 
                      : "border-white/5 bg-white/30 hover:border-white/20 dark:bg-white/5 dark:border-white/10"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
                    isGlobalMode 
                      ? "border-brand bg-brand text-white" 
                      : "border-slate-300 bg-transparent dark:border-white/20"
                  }`}>
                    {isGlobalMode && <Check size={16} strokeWidth={4} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-black transition-colors ${isGlobalMode ? "text-brand" : "text-ink dark:text-white"}`}>
                        Definir valor final para a proposta
                      </p>
                      {isGlobalMode && (
                        <span className="rounded-full bg-brand px-1.5 py-0.5 text-[8px] font-black uppercase text-white animate-pulse">Ativo</span>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Substitui a soma individual por um valor único no carrinho</p>
                  </div>
                </button>

                {isGlobalMode && (
                  <div className="relative animate-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black text-brand/60">R$</span>
                    <input 
                      className="w-full h-14 rounded-2xl border-2 border-brand bg-brand/5 pl-12 text-xl font-black text-brand outline-none focus:ring-4 focus:ring-brand/10 transition-all dark:bg-brand/10 dark:text-white"
                      type="number"
                      value={globalTotal}
                      onChange={(e) => setGlobalTotal(e.target.value)}
                      placeholder="0,00"
                      autoFocus
                    />
                  </div>
                )}

                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <MessageSquare className="absolute left-4 top-4 text-slate-400 dark:text-slate-500" size={18} />
                  <textarea 
                    className="w-full min-h-[100px] rounded-2xl border border-white/5 bg-white/30 p-4 pl-12 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-brand/20 dark:bg-white/5 dark:text-white dark:border-white/10"
                    placeholder="Adicione uma mensagem (opcional)..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Footer Area */}
          <div className={`shrink-0 border-t border-white/5 bg-white/50 p-5 backdrop-blur-md dark:bg-black/40 transition-opacity duration-300 ${isExpanded ? "opacity-100 delay-150" : "opacity-0 pointer-events-none"}`}>
            <div className="mb-4 flex items-center justify-between px-1">
              <span className="text-sm font-black text-slate-500 uppercase tracking-widest dark:text-slate-400">Total da Proposta</span>
              <span className={`text-2xl font-black transition-colors ${isGlobalMode ? "text-brand" : "text-ink dark:text-white"}`}>
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
