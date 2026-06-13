import { FormEvent, useEffect, useState, useMemo, type ReactNode } from "react";
import {
  CalendarDays,
  DollarSign,
  Gavel,
  Pencil,
  Plus,
  Save,
  Shield,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  formatCardNumber,
  formatCardVariant,
  type CardCondition,
  type CardLanguage,
  type CardSummary,
  type CollectionAddResult,
  type CollectionItem,
  type PriceEstimate,
} from "@poke-organizer/shared";
import { api, apiFeedback } from "../lib/api";
import { formatBrl } from "../lib/format";
import { CardVariantImage } from "./collection/CardVariantImage";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Skeleton } from "./ui/Skeleton";

export type AddCardDetails = {
  cardId: string;
  quantity: number;
  condition: CardCondition;
  variant: string;
  foil: boolean;
  language: CardLanguage;
  notes?: string;
  customPrice?: number | null;
};

export type UpdateCardDetails = Omit<AddCardDetails, "cardId">;

type Props = {
  card?: CardSummary | null;
  collectionItem?: CollectionItem | null;
  collectionPrice?: PriceEstimate | null;
  initialVariant?: string | null;
  mode?: "add" | "edit";
  price?: PriceEstimate;
  onAdd?: (details: AddCardDetails) => Promise<CollectionAddResult | undefined>;
  onUpdate?: (itemId: string, details: UpdateCardDetails) => Promise<void>;
  onStartAuction?: (item: CollectionItem) => void;
  quantityLabel?: string;
  quantityHelp?: string;
  maxQuantity?: number;
  metadataEditable?: boolean;
  onClose: () => void;
};

export function CardDetailModal({
  card: detailCard,
  collectionItem,
  collectionPrice,
  initialVariant,
  mode: initialMode,
  price: detailPrice,
  onAdd,
  onUpdate,
  onStartAuction,
  quantityLabel = "Quantidade",
  quantityHelp,
  maxQuantity,
  metadataEditable = true,
  onClose,
}: Props) {
  const card = detailCard || collectionItem?.card;
  const mode = initialMode || (collectionItem ? "edit" : "add");

  const variants = useMemo(() => {
    if (!card) return ["normal"];
    return card.variants && card.variants.length > 0 ? card.variants : ["normal"];
  }, [card]);

  const [quantity, setQuantity] = useState(collectionItem?.quantity ?? 1);
  const [condition, setCondition] = useState<CardCondition>(collectionItem?.condition ?? "NM");
  const [variant, setVariant] = useState(() => {
    if (collectionItem) return collectionItem.variant;
    
    // For new cards, wait for useEffect to sync based on variants and initialVariant
    // But if we already have card and variants, we can try to guess
    if (card) {
       const initial = initialVariant && card.variants.includes(initialVariant) ? initialVariant : null;
       const v = card.variants && card.variants.length > 0 ? card.variants : ["normal"];
       return initial || (v.includes("normal") ? "normal" : v[0]);
    }

    return "normal";
  });
  const [language, setLanguage] = useState<CardLanguage>(() => {
    if (collectionItem) return collectionItem.language;
    return CARD_LANGUAGES.includes("pt-BR") ? "pt-BR" : CARD_LANGUAGES[0];
  });
  const [notes, setNotes] = useState(collectionItem?.notes ?? "");
  const [customPrice, setCustomPrice] = useState<number | null>(() => {
    if (collectionItem?.store?.manualPrice !== undefined && collectionItem?.store?.manualPrice !== null) {
      return collectionItem.store.manualPrice;
    }
    return collectionItem?.customPrice ?? null;
  });
  
  const [fetchedPrice, setFetchedPrice] = useState<PriceEstimate | null>(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Sync state when collectionItem changes
  useEffect(() => {
    if (collectionItem) {
      setQuantity(collectionItem.quantity);
      setCondition(collectionItem.condition);
      setVariant(collectionItem.variant);
      setLanguage(collectionItem.language);
      setNotes(collectionItem.notes ?? "");
      
      const existingManual = collectionItem.store?.manualPrice !== undefined && collectionItem.store?.manualPrice !== null
        ? collectionItem.store.manualPrice
        : collectionItem.customPrice ?? null;
        
      setCustomPrice(existingManual);
    }
  }, [collectionItem]);

  const imageSrc = card?.imageLarge ?? card?.imageSmall;

  // Reset loading state when card or image changes
  useEffect(() => {
    if (!imageSrc) {
      setImageLoading(false);
    } else {
      setImageLoading(true);
    }
  }, [card?.id, imageSrc]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial state and handle variant defaults
  useEffect(() => {
    if (collectionItem) {
      setQuantity(collectionItem.quantity);
      setCondition(collectionItem.condition);
      setVariant(collectionItem.variant);
      setLanguage(collectionItem.language);
      setNotes(collectionItem.notes ?? "");
      setCustomPrice(collectionItem.customPrice ?? null);
    } else if (card) {
      // If adding, pick normal if available, else first variant
      // But if initialVariant is provided and valid, use it
      const validInitial = initialVariant && variants.includes(initialVariant) ? initialVariant : null;
      const defaultVariant = validInitial || (variants.includes("normal") ? "normal" : variants[0]);
      
      setVariant(defaultVariant);
      setLanguage(CARD_LANGUAGES.includes("pt-BR") ? "pt-BR" : CARD_LANGUAGES[0]);
    }
  }, [collectionItem, card, initialVariant, variants]);

  // Fetch price when critical attributes change
  useEffect(() => {
    if (!card?.id || mode !== "add") {
      setFetchedPrice(null);
      return;
    }

    // Skip if variant is "normal" but "normal" is not in variants (wait for sync)
    if (variant === "normal" && !variants.includes("normal") && variants.length > 0 && variants[0] !== "normal") {
      return;
    }

    let cancelled = false;
    async function fetchPrice() {
      setIsFetchingPrice(true);
      try {
        const p = await api.getPrice(card!.id, { variant, language, condition });
        if (!cancelled) setFetchedPrice(p);
      } catch (err) {
        if (!cancelled) setFetchedPrice(null);
      } finally {
        if (!cancelled) setIsFetchingPrice(false);
      }
    }

    void fetchPrice();
    return () => { cancelled = true; };
  }, [card?.id, variant, language, condition, mode, variants]);

  const activePrice = detailPrice || collectionPrice || collectionItem?.price || fetchedPrice;

  if (!card) return null;

  const fullNumber = formatCardNumber(card.number, card.printedTotal);

  const hasAmount = activePrice?.amount !== null && activePrice?.amount !== undefined;
  const priceDisplay = hasAmount
    ? formatBrl(activePrice!.amount!)
    : isFetchingPrice ? "Carregando..." : "Valor não disponível";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!onAdd && (!collectionItem || !onUpdate)) return;

    setSubmitting(true);
    setError(null);

    try {
      // Ensure the variant is valid before sending
      let finalVariant = variant;
      if (!variants.includes(variant)) {
        finalVariant = variants.includes("normal") ? "normal" : variants[0];
      }

      const v = finalVariant.toLowerCase();
      const isFoil = v.includes("foil") || v.includes("holo");
      
      const details = {
        quantity,
        condition,
        variant: finalVariant,
        foil: isFoil,
        language,
        notes: notes.trim() || undefined,
        customPrice,
      };

      if (onAdd && card) {
        const result = await onAdd({
          cardId: card.id,
          ...details,
        });
        if (result?.action === "incremented") {
          apiFeedback.success("Quantidade incrementada no seu inventário.");
        } else {
          apiFeedback.success("Carta adicionada ao seu inventário.");
        }
      } else if (collectionItem && onUpdate) {
        await onUpdate(collectionItem.id, details);
        apiFeedback.success("Alterações salvas com sucesso.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  const showRightColumn = onAdd || (collectionItem && onUpdate) || (collectionItem && onStartAuction);

  return (
    <Modal
      title={card.name}
      subtitle={fullNumber}
      onClose={onClose}
      maxWidthClass={showRightColumn ? 'max-w-5xl' : 'max-w-3xl'}
      footer={showRightColumn ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-brand">
                <Sparkles size={24} />
             </div>
             <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estimativa atual</p>
                {isFetchingPrice ? (
                  <Skeleton className="h-6 w-32 mt-1" />
                ) : (
                  <p className="text-xl font-black text-foreground">{priceDisplay}</p>
                )}
             </div>
          </div>
          <div className="flex gap-3">
            {collectionItem && onStartAuction && (
              <Button
                type="button"
                variant="ghost"
                className="px-6 text-muted-foreground border border-card-border"
                icon={<Gavel size={18} />}
                onClick={() => {
                  onClose();
                  onStartAuction(collectionItem);
                }}
              >
                Leiloar
              </Button>
            )}
            <Button
              form="card-detail-form"
              type="submit"
              variant="brand"
              className="px-12 py-3 shadow-glow min-w-[160px] relative"
              disabled={submitting}
              icon={!submitting && (mode === "add" ? <Plus size={20} /> : <Save size={20} />)}
            >
              {submitting ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </div>
              ) : (
                mode === "add" ? "Adicionar" : "Salvar"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    >
      <div className={`grid gap-8 p-6 ${showRightColumn ? 'lg:grid-cols-[1fr_400px]' : ''}`}>
        <div className="min-w-0">
          <div className={`mx-auto w-full mb-8 ${showRightColumn ? 'max-w-[390px]' : 'max-w-[320px]'} relative group aspect-[5/7]`}>
              {imageLoading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-card rounded-[24px] border border-card-border/40">
                   <Skeleton className="h-full w-full rounded-[24px]" />
                </div>
              )}
              <CardVariantImage
                src={imageSrc}
                alt={card.name}
                variant={variant}
                effect="frame"
                className={`rounded-[24px] border border-card-border/40 bg-card shadow-card transition-opacity duration-300 h-full w-full ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                imageClassName="rounded-[18px] object-contain h-full w-full"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageLoading(false)}
              />
          </div>

          <h3 className="mb-3 text-xl font-black text-foreground uppercase tracking-widest text-[14px]">Atributos</h3>
          <dl className={`grid gap-3 ${showRightColumn ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
            <Detail
              icon={<Pencil size={18} />}
              label="Ilustrador"
              value={card.artist ?? "Não informado"}
            />
            <Detail
              icon={<CalendarDays size={18} />}
              label="Lançamento"
              value={card.releaseDate ?? "Não informado"}
            />
            <Detail
              icon={<Shield size={18} />}
              label="Raridade"
              value={card.rarity ?? "Não informado"}
            />
            <Detail
              icon={<Zap size={18} />}
              label="Marca"
              value={card.regulationMark ?? "Não informado"}
            />
            <Detail
              icon={<Sparkles size={18} />}
              label="Variante"
              value={formatCardVariant(variant)}
            />
            <Detail
              icon={<Tag size={18} />}
              label="Coleção"
              value={card.setName ?? "Não informado"}
            />
            <Detail
              icon={<Plus size={18} />}
              label="Idioma"
              value={language === 'pt-BR' ? 'Português' : language === 'en' ? 'Inglês' : language === 'ja' ? 'Japonês' : 'Desconhecido'}
            />
          </dl>
        </div>

        {showRightColumn && (
          <aside className="lg:sticky lg:top-0">
            <div className="rounded-[32px] border border-card-border/50 bg-card/70 p-6 shadow-sm">
              <form id="card-detail-form" onSubmit={submit}>
                <h3 className="text-xl font-black text-foreground uppercase tracking-widest text-[14px] mb-6">
                  {mode === "add" ? "Configurar Adição" : "Editar Entrada"}
                </h3>

                <div className="grid gap-5">
                  {activePrice && (
                    <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4 mb-2">
                       <p className="text-[10px] font-black uppercase tracking-widest text-brand/60">Preço de Mercado</p>
                       <p className="text-lg font-black text-brand mt-0.5">{priceDisplay}</p>
                       {activePrice.source && (
                         <p className="text-[9px] font-bold text-brand/40 uppercase mt-1">Fonte: {activePrice.source}</p>
                       )}
                    </div>
                  )}

                  <label className="grid gap-2">
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{quantityLabel}</span>
                    <input
                      type="number"
                      min="1"
                      max={maxQuantity}
                      className="premium-input"
                      value={quantity}
                      onChange={(event) => {
                        const nextQuantity = Math.max(1, parseInt(event.target.value) || 1);
                        setQuantity(maxQuantity ? Math.min(maxQuantity, nextQuantity) : nextQuantity);
                      }}
                    />
                    {quantityHelp && <span className="px-1 text-xs font-bold text-muted-foreground">{quantityHelp}</span>}
                  </label>

                  {metadataEditable && (
                    <>
                      <label className="grid gap-2">
                        <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Condição</span>
                        <select
                          className="premium-select"
                          value={condition}
                          onChange={(event) => setCondition(event.target.value as CardCondition)}
                        >
                          {CARD_CONDITIONS.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Variante</span>
                        <select
                          className="premium-select"
                          value={variant}
                          onChange={(event) => setVariant(event.target.value)}
                        >
                          {variants.map((v) => (
                            <option key={v} value={v}>{formatCardVariant(v)}</option>
                          ))}
                        </select>
                      </label>

                      <label className="grid gap-2">
                        <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Idioma</span>
                        <select
                          className="premium-select"
                          value={language}
                          onChange={(event) => setLanguage(event.target.value as CardLanguage)}
                        >
                          {CARD_LANGUAGES.map((l) => (
                            <option key={l} value={l}>{l === 'pt-BR' ? 'Português' : l === 'en' ? 'Inglês' : l === 'ja' ? 'Japonês' : 'Desconhecido'}</option>
                          ))}
                        </select>
                      </label>
                    </>
                  )}

                  <label className="grid gap-2">
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preço Manual (Opcional)</span>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                      <input
                        type="number"
                        step="0.01"
                        className="premium-input pl-12"
                        placeholder="R$ 0,00"
                        value={customPrice ?? ""}
                        onChange={(event) => setCustomPrice(event.target.value ? parseFloat(event.target.value) : null)}
                      />
                    </div>
                  </label>
                </div>

                {error && (
                  <div className="mt-6 p-4 rounded-2xl text-[11px] font-black uppercase tracking-wider text-center bg-magenta/10 border border-magenta/20 text-magenta">
                    {error}
                  </div>
                )}
              </form>
            </div>
          </aside>
        )}
      </div>
    </Modal>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-card-border/40 bg-card/50 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="truncate text-xs font-bold text-foreground">{value}</p>
    </div>
  );
}
