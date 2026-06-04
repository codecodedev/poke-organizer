import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Circle, DollarSign, Hash, Pencil, Plus, Save, Shield, Sparkles, Tag, X, Zap } from "lucide-react";
import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  DEFAULT_CARD_VARIANT,
  FOIL_CARD_VARIANT,
  formatCardNumber,
  formatCardVariant,
  type CardCondition,
  type CardLanguage,
  type CardSummary,
  type CollectionAddResult,
  type CollectionItem,
  type PriceEstimate
} from "@poke-organizer/shared";
import { api } from "../lib/api";
import { formatBrl } from "../lib/format";
import { CardVariantImage } from "./collection/CardVariantImage";

export type AddCardDetails = {
  cardId: string;
  quantity: number;
  condition: CardCondition;
  variant: string;
  foil: boolean;
  language: CardLanguage;
  notes?: string;
};

export type UpdateCardDetails = Omit<AddCardDetails, "cardId">;

type Props = {
  card: CardSummary | null;
  onClose: () => void;
  onAdd?: (details: AddCardDetails) => Promise<CollectionAddResult | void> | CollectionAddResult | void;
  initialVariant?: string | null;
  collectionItem?: CollectionItem | null;
  collectionPrice?: PriceEstimate | null;
  onUpdate?: (itemId: string, details: UpdateCardDetails) => Promise<void> | void;
};

export function CardDetailModal({
  card,
  onClose,
  onAdd,
  initialVariant,
  collectionItem,
  collectionPrice,
  onUpdate
}: Props) {
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>("NM");
  const [variant, setVariant] = useState(DEFAULT_CARD_VARIANT);
  const [language, setLanguage] = useState<CardLanguage>("unknown");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<PriceEstimate | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const variants = useMemo(() => {
    const values = card?.variants?.length ? [...card.variants] : [DEFAULT_CARD_VARIANT];
    if (initialVariant && !values.includes(initialVariant)) {
      values.push(initialVariant);
    }
    if (collectionItem?.variant && !values.includes(collectionItem.variant)) {
      values.push(collectionItem.variant);
    }
    return Array.from(new Set(values));
  }, [card?.variants, collectionItem?.variant, initialVariant]);

  const mode: "add" | "edit" | "view" = onAdd ? "add" : collectionItem && onUpdate ? "edit" : "view";

  useEffect(() => {
    if (!card) return;
    setQuantity(collectionItem?.quantity ?? 1);
    setCondition(collectionItem?.condition ?? "NM");
    setVariant(collectionItem?.variant ?? initialVariant ?? (card.variants?.includes(DEFAULT_CARD_VARIANT) ? DEFAULT_CARD_VARIANT : card.variants?.[0]) ?? DEFAULT_CARD_VARIANT);
    setLanguage(collectionItem?.language ?? card.language);
    setNotes(collectionItem?.notes ?? "");
    setError(null);
    setSubmitMessage(null);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [card, collectionItem, initialVariant, onClose]);

  useEffect(() => {
    if (!card) return;

    let cancelled = false;
    setPriceLoading(true);
    api
      .getPrice(card.id, { variant, language, condition })
      .then((estimate) => {
        if (!cancelled) setPrice(estimate);
      })
      .catch(() => {
        if (!cancelled) setPrice(null);
      })
      .finally(() => {
        if (!cancelled) setPriceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [card, condition, language, variant]);

  useEffect(() => {
    setPrice(collectionPrice ?? null);
  }, [collectionPrice]);

  useEffect(() => {
    if (!card) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [card]);

  if (!card) {
    return null;
  }

  const detailCard = card;
  const fullNumber = formatCardNumber(card.number, card.printedTotal);
  const nationalNumber = card.nationalPokedexNumbers?.[0]?.toString() ?? "Nao informado";
  const typeText = card.types?.length ? card.types.join(", ") : "Nao informado";
  const hasBrazilianPrice = Boolean(price?.amount && !price.isFallback);
  const displayedPrice = priceLoading
    ? "Buscando valor..."
    : hasBrazilianPrice && price?.amount
      ? formatBrl(price.amount)
      : "Valor nao encontrado";
  const variantAttributeLabel = collectionItem ? "Variante" : "Variantes";
  const variantAttributeValue = collectionItem ? formatCardVariant(variant) : variants.map(formatCardVariant).join(", ");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!onAdd && (!collectionItem || !onUpdate)) return;

    setSubmitting(true);
    setError(null);

    try {
      const details = {
        quantity,
        condition,
        variant,
        foil: isFoilVariant(variant),
        language,
        notes: notes.trim() || undefined
      };

      if (onAdd) {
        const result = await onAdd({
          cardId: detailCard.id,
          ...details
        });
        if (result?.action === "incremented") {
          setSubmitMessage("Carta ja existia com estes atributos; a quantidade foi incrementada.");
        } else if (result?.action === "created") {
          setSubmitMessage("Carta adicionada como nova entrada na colecao.");
        }
      } else if (collectionItem && onUpdate) {
        await onUpdate(collectionItem.id, details);
        setSubmitMessage("Alteracoes salvas.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar carta");
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      onMouseDown={onClose}
    >
      <div
        className="animate-soft-pop max-h-[80vh] w-full max-w-5xl overflow-auto rounded-[26px] border border-white/80 bg-white shadow-card"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="holo-strip animate-shimmer h-2" />
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <div>
            <h2 id="card-detail-title" className="text-2xl font-black text-ink">
              {card.name}
            </h2>
            <p className="text-sm font-semibold text-slate-600">{fullNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40"
            aria-label="Fechar detalhes"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-6 p-5">
          <div className="mx-auto w-full max-w-[390px]">
            <CardVariantImage
              src={card.imageLarge ?? card.imageSmall}
              alt={card.name}
              variant={variant}
              effect="frame"
              className=" rounded-[24px] border border-line/80 bg-gradient-to-br from-aqua/15 to-lilac/15 shadow-card"
              imageClassName="rounded-[18px] object-contain"
            />
          </div>

          <div className="min-w-0">
            <h3 className="mb-3 text-xl font-black text-ink">Atributos</h3>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Detail icon={<Pencil size={18} />} label="Ilustrador" value={card.artist ?? "Nao informado"} />
              <Detail icon={<CalendarDays size={18} />} label="Lancamento" value={card.releaseDate ?? "Nao informado"} />
              <Detail icon={<Circle size={18} />} label="Raridade" value={card.rarity ?? "Nao informado"} />
              <Detail icon={<Hash size={18} />} label="Numero Nacional" value={nationalNumber} />
              <Detail icon={<Zap size={18} />} label="Tipo" value={typeText} />
              <Detail icon={<Shield size={18} />} label="Marca de Regulamento" value={card.regulationMark ?? "Nao informado"} />
              <Detail icon={<Tag size={18} />} label="Colecao" value={card.setName ?? "Nao informado"} />
              <Detail icon={<Sparkles size={18} />} label={variantAttributeLabel} value={variantAttributeValue} />
              <Detail icon={<DollarSign size={18} />} label="Valor" value={displayedPrice} />
            </dl>

            {(onAdd || (collectionItem && onUpdate)) && (
              <form onSubmit={submit} className="mt-5 rounded-[22px] border border-line/80 bg-gradient-to-br from-white to-field/80 p-4 shadow-sm">
                <h3 className="text-lg font-black text-ink">
                  {mode === "add" ? "Adicionar a colecao" : "Editar na colecao"}
                </h3>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-black text-slate-700">
                    Variante
                    <select
                      className="premium-select mt-2 w-full"
                      value={variant}
                      onChange={(event) => setVariant(event.target.value)}
                    >
                      {variants.map((item) => (
                        <option key={item} value={item}>
                          {formatCardVariant(item)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Quantidade
                    <input
                      className="premium-input mt-2 w-full"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Condicao
                    <select
                      className="premium-select mt-2 w-full"
                      value={condition}
                      onChange={(event) => setCondition(event.target.value as CardCondition)}
                    >
                      {CARD_CONDITIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Idioma
                    <select
                      className="premium-select mt-2 w-full"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value as CardLanguage)}
                    >
                      {CARD_LANGUAGES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Valor
                    <input
                      className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-slate-100 px-4 font-semibold text-slate-700"
                      value={displayedPrice}
                      readOnly
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700 sm:col-span-2">
                    Notas
                    <textarea
                      className="focus-ring mt-2 min-h-24 w-full rounded-2xl border border-line bg-white/90 px-4 py-3"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                {!priceLoading && !hasBrazilianPrice && (
                  <p className="mt-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                    Nenhum valor nacional encontrado para esta carta.
                  </p>
                )}
                {!priceLoading && hasBrazilianPrice && price?.label && (
                  <p className="mt-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                    {price.label}
                  </p>
                )}
                {submitMessage && (
                  <p className="success-note mt-3">
                    {submitMessage}
                  </p>
                )}
                {error && <p className="danger-note mt-3">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary mt-4 disabled:opacity-60"
                >
                  {mode === "add" ? <Plus size={18} /> : <Save size={18} />}
                  {submitting ? "Salvando" : mode === "add" ? "Adicionar" : "Salvar alteracoes"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function isFoilVariant(variant: string): boolean {
  return variant === FOIL_CARD_VARIANT || variant.toLowerCase().includes("holo");
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3 rounded-[18px] border border-line/80 bg-white/70 p-3 shadow-sm">
      <div className="mt-1 text-lilac">{icon}</div>
      <div className="min-w-0">
        <dt className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</dt>
        <dd className="mt-1 break-words text-sm font-black text-ink">{value}</dd>
      </div>
    </div>
  );
}
