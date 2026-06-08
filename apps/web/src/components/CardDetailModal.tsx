import { FormEvent, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Circle,
  DollarSign,
  Gavel,
  Hash,
  Pencil,
  Plus,
  Save,
  Shield,
  Sparkles,
  Tag,
  X,
  Zap,
} from "lucide-react";
// ... (rest of shared imports)
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
  type PriceEstimate,
} from "@poke-organizer/shared";
import { api } from "../lib/api";
import { formatBrl } from "../lib/format";
import { CardVariantImage } from "./collection/CardVariantImage";
import { Button } from "./ui/Button";

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
  card: CardSummary | null;
  onClose: () => void;
  onAdd?: (
    details: AddCardDetails,
  ) => Promise<CollectionAddResult | void> | CollectionAddResult | void;
  initialVariant?: string | null;
  collectionItem?: CollectionItem | null;
  collectionPrice?: PriceEstimate | null;
  onUpdate?: (
    itemId: string,
    details: UpdateCardDetails,
  ) => Promise<void> | void;
  onStartAuction?: (item: CollectionItem) => void;
};

export function CardDetailModal({
  card,
  onClose,
  onAdd,
  initialVariant,
  collectionItem,
  collectionPrice,
  onUpdate,
  onStartAuction,
}: Props) {
// ... (rest of state logic)
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>("NM");
  const [variant, setVariant] = useState(DEFAULT_CARD_VARIANT);
  const [language, setLanguage] = useState<CardLanguage>("unknown");
  const [notes, setNotes] = useState("");
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [showPriceWarning, setShowPriceWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState<PriceEstimate | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [showAuctionForm, setShowAuctionCreation] = useState(false);

  const variants = useMemo(() => {
// ... (variants logic)
    const values = card?.variants?.length
      ? [...card.variants]
      : [DEFAULT_CARD_VARIANT];
    if (initialVariant && !values.includes(initialVariant)) {
      values.push(initialVariant);
    }
    if (collectionItem?.variant && !values.includes(collectionItem.variant)) {
      values.push(collectionItem.variant);
    }
    return Array.from(new Set(values));
  }, [card?.variants, collectionItem?.variant, initialVariant]);

  const mode: "add" | "edit" | "view" = onAdd
    ? "add"
    : collectionItem && onUpdate
      ? "edit"
      : "view";

  useEffect(() => {
// ... (useEffect logic)
    if (!card) return;
    setQuantity(collectionItem?.quantity ?? 1);
    setCondition(collectionItem?.condition ?? "NM");
    setVariant(
      collectionItem?.variant ??
        initialVariant ??
        (card.variants?.includes(DEFAULT_CARD_VARIANT)
          ? DEFAULT_CARD_VARIANT
          : card.variants?.[0]) ??
        DEFAULT_CARD_VARIANT,
    );
    setLanguage(collectionItem?.language ?? card.language);
    setNotes(collectionItem?.notes ?? "");
    setCustomPrice(collectionItem?.customPrice ?? null);
    setShowPriceWarning(false);
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

// ... (Price logic)
  useEffect(() => {
    if (!card) return;

    let cancelled = false;
    setPriceLoading(true);
    api
      .getPrice(card.id, { variant, language, condition })
      .then((estimate) => {
        if (!cancelled) {
          setPrice({
            ...estimate,
            history: estimate.history ?? collectionPrice?.history,
          });
        }
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
  }, [card, collectionPrice?.history, condition, language, variant]);

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
  const nationalNumber =
    card.nationalPokedexNumbers?.[0]?.toString() ?? "Nao informado";
  const typeText = card.types?.length ? card.types.join(", ") : "Nao informado";
  const hasBrazilianPrice = Boolean(price?.amount && !price.isFallback);
  const displayedPrice = priceLoading
    ? "Buscando valor..."
    : hasBrazilianPrice && price?.amount
      ? formatBrl(price.amount)
      : "Valor nao encontrado";
  const variantAttributeLabel = collectionItem ? "Variante" : "Variantes";
  const variantAttributeValue = collectionItem
    ? formatCardVariant(variant)
    : variants.map(formatCardVariant).join(", ");

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
        notes: notes.trim() || undefined,
        customPrice,
      };

      if (onAdd) {
        const result = await onAdd({
          cardId: detailCard.id,
          ...details,
        });
        if (result?.action === "incremented") {
          setSubmitMessage(
            "Carta ja existia com estes atributos; a quantidade foi incrementada.",
          );
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

  const showRightColumn = onAdd || (collectionItem && onUpdate) || (collectionItem && onStartAuction);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-night/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-detail-title"
      onMouseDown={onClose}
    >
      <div
        className={`card-detail-modal animate-soft-pop max-h-[90vh] w-full ${showRightColumn ? 'max-w-5xl' : 'max-w-3xl'} overflow-auto rounded-[26px] border border-white/80 bg-white shadow-card`}
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

        <div className={`grid gap-8 p-5 ${showRightColumn ? 'lg:grid-cols-[1fr_400px]' : ''}`}>
          <div className="min-w-0">
            <div className={`mx-auto w-full mb-8 ${showRightColumn ? 'max-w-[390px]' : 'max-w-[320px]'} relative`}>
                <CardVariantImage
                src={card.imageLarge ?? card.imageSmall}
                alt={card.name}
                variant={variant}
                effect="frame"
                className=" rounded-[24px] border border-line/80 bg-gradient-to-br from-aqua/15 to-lilac/15 shadow-card"
                imageClassName="rounded-[18px] object-contain"
                />
            </div>

            <h3 className="mb-3 text-xl font-black text-ink">Atributos</h3>
            <dl className={`grid gap-3 ${showRightColumn ? 'sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
              <Detail
                icon={<Pencil size={18} />}
                label="Ilustrador"
                value={card.artist ?? "Nao informado"}
              />
              <Detail
                icon={<CalendarDays size={18} />}
                label="Lancamento"
                value={card.releaseDate ?? "Nao informado"}
              />
              <Detail
                icon={<Circle size={18} />}
                label="Raridade"
                value={card.rarity ?? "Nao informado"}
              />
              <Detail
                icon={<Hash size={18} />}
                label="Numero Nacional"
                value={nationalNumber}
              />
              <Detail icon={<Zap size={18} />} label="Tipo" value={typeText} />
              <Detail
                icon={<Shield size={18} />}
                label="Marca de Regulamento"
                value={card.regulationMark ?? "Nao informado"}
              />
              <Detail
                icon={<Tag size={18} />}
                label="Colecao"
                value={card.setName ?? "Nao informado"}
              />
              <Detail
                icon={<Sparkles size={18} />}
                label={variantAttributeLabel}
                value={variantAttributeValue}
              />
              <Detail
                icon={<DollarSign size={18} />}
                label="Valor"
                value={displayedPrice}
              />
            </dl>

            {price?.history?.length ? (
              <PriceHistoryChart price={price} />
            ) : null}
          </div>

          <div className="space-y-6">
            {(onAdd || (collectionItem && onUpdate)) && (
              <form
                onSubmit={submit}
                className="card-detail-form rounded-[22px] border border-line/80 bg-gradient-to-br from-white to-field/80 p-5 shadow-sm"
              >
                <h3 className="text-lg font-black text-ink">
                  {mode === "add" ? "Adicionar a colecao" : "Editar na colecao"}
                </h3>

                <div className="mt-4 grid gap-4">
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

                  <div className="grid grid-cols-2 gap-3">
                      <label className="text-sm font-black text-slate-700">
                        Quantidade
                        <input
                          className="premium-input mt-2 w-full"
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(event) =>
                            setQuantity(Math.max(1, Number(event.target.value)))
                          }
                        />
                      </label>

                      <label className="text-sm font-black text-slate-700">
                        Condicao
                        <select
                          className="premium-select mt-2 w-full"
                          value={condition}
                          onChange={(event) =>
                            setCondition(event.target.value as CardCondition)
                          }
                        >
                          {CARD_CONDITIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>
                  </div>

                  <label className="text-sm font-black text-slate-700">
                    Idioma
                    <select
                      className="premium-select mt-2 w-full"
                      value={language}
                      onChange={(event) =>
                        setLanguage(event.target.value as CardLanguage)
                      }
                    >
                      {CARD_LANGUAGES.map((item) => (
                        <option key={item} value={item}>
                          {getLanguageFlag(item)} {item === "unknown" ? "Desconhecido" : item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Valor
                    <input
                      className="card-detail-readonly mt-2 min-h-12 w-full rounded-2xl border border-line bg-slate-100 px-4 font-semibold text-slate-700"
                      value={displayedPrice}
                      readOnly
                    />
                  </label>

                  <label className="text-sm font-black text-slate-700">
                    Preço Customizado (Opcional)
                    <div className="relative mt-2">
                      <DollarSign
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                        size={17}
                      />
                      <input
                        className="premium-input w-full pl-11"
                        type="number"
                        step="0.01"
                        min={0}
                        value={customPrice ?? ""}
                        onChange={(event) => {
                          const val =
                            event.target.value === ""
                              ? null
                              : Number(event.target.value);
                          if (
                            val !== null &&
                            !showPriceWarning &&
                            val !== collectionItem?.customPrice
                          ) {
                            setShowPriceWarning(true);
                          }
                          setCustomPrice(val);
                        }}
                        placeholder="Usar valor do mercado"
                      />
                    </div>
                  </label>

                  {showPriceWarning && (
                    <div className="rounded-xl border-2 border-amber/60 bg-amber/10 p-4 text-xs font-black text-ink dark:text-amber-200 dark:bg-amber-900/30 dark:border-amber-500/50 animate-soft-pop shadow-sm flex items-start gap-3">
                      <div className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400">
                        <Shield size={18} />
                      </div>
                      <p className="leading-relaxed">
                        Atenção: Ao definir um preço customizado, esta carta não seguirá mais as flutuações automáticas do mercado.
                      </p>
                    </div>
                  )}

                  <label className="text-sm font-black text-slate-700">
                    Notas
                    <textarea
                      className="premium-input focus-ring mt-2 min-h-24 w-full rounded-2xl border border-line bg-white/90 px-4 py-3"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                {!priceLoading && !hasBrazilianPrice && (
                  <p className="card-detail-note mt-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                    Nenhum valor nacional encontrado para esta carta.
                  </p>
                )}
                {submitMessage && (
                  <p className="success-note mt-3">{submitMessage}</p>
                )}
                {error && <p className="danger-note mt-3">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary mt-6 w-full shadow-lg disabled:opacity-60"
                >
                  {mode === "add" ? <Plus size={18} /> : <Save size={18} />}
                  {submitting
                    ? "Salvando"
                    : mode === "add"
                      ? "Adicionar"
                      : "Salvar alteracoes"}
                </button>
              </form>
            )}

            {collectionItem && onStartAuction && (
                <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
                   <div className="flex items-center gap-3 mb-4">
                     <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-white shadow-sm">
                        <Gavel size={22} />
                     </div>
                     <div>
                        <h4 className="font-black text-amber-900">Leilão Direto</h4>
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Novo recurso</p>
                     </div>
                   </div>
                   <p className="text-sm font-medium text-amber-800 leading-relaxed">
                     Inicie um leilão separado para esta carta e compartilhe o link com quem quiser!
                   </p>
                   <Button
                     variant="brand"
                     className="mt-5 w-full bg-amber-400 text-amber-950 hover:bg-amber-300 border-amber-500/20"
                     onClick={() => onStartAuction(collectionItem)}
                   >
                     Iniciar Leilão
                   </Button>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function isFoilVariant(variant: string): boolean {
  return (
    variant === FOIL_CARD_VARIANT || variant.toLowerCase().includes("holo")
  );
}

function PriceHistoryChart({ price }: { price: PriceEstimate }) {
  const history = price.history ?? [];
  const first = history[0];
  if (!first) return null;

  const data = [
    { amount: first.previousAmount, changedAt: first.changedAt },
    ...history.map((entry) => ({
      amount: entry.amount,
      changedAt: entry.changedAt,
    })),
  ];
  const latest = history[history.length - 1];
  const latestChange = latest.amount - latest.previousAmount;
  const values = data.map((entry) => entry.amount);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 320;
  const height = 130;
  const paddingX = 18;
  const paddingY = 18;
  const points = data.map((entry, index) => {
    const x =
      paddingX +
      (index / Math.max(1, data.length - 1)) * (width - paddingX * 2);
    const y =
      paddingY + ((max - entry.amount) / range) * (height - paddingY * 2);
    return { ...entry, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const latestTone = latestChange >= 0 ? "price-history-chart__delta--up" : "price-history-chart__delta--down";
  const chartStyle = {
    "--price-chart-trend": latestChange >= 0 ? "var(--price-chart-up)" : "var(--price-chart-down)",
  } as CSSProperties;

  return (
    <section className="price-history-chart mt-5 rounded-[22px] border border-line/80 bg-gradient-to-br from-white to-field/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-ink">Historico de valores</h3>
          <p className="text-sm font-semibold text-slate-500">
            {data.length} pontos registrados
          </p>
        </div>
        <span
          className={`price-history-chart__delta rounded-full border border-line/70 bg-white/80 px-3 py-1.5 text-xs font-black ${latestTone}`}
        >
          {latestChange >= 0 ? "Subiu" : "Caiu"}{" "}
          {formatBrl(Math.abs(latestChange))}
        </span>
      </div>

      <div className="price-history-chart__plot mt-4 overflow-hidden rounded-2xl border border-line/70 bg-white/70 p-3" style={chartStyle}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-40 w-full"
          role="img"
          aria-label="Grafico do historico de valores"
        >
          <line
            x1={paddingX}
            y1={paddingY}
            x2={paddingX}
            y2={height - paddingY}
            stroke="var(--price-chart-axis)"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="var(--price-chart-axis)"
            strokeWidth="1"
          />
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--price-chart-trend)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          {points.map((point, index) => (
            <circle
              key={`${point.changedAt}-${index}`}
              cx={point.x}
              cy={point.y}
              r="4.5"
              fill="var(--price-chart-point-bg)"
              stroke="var(--price-chart-trend)"
              strokeWidth="3"
            />
          ))}
        </svg>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs font-black text-slate-500">
          <span>{formatBrl(min)}</span>
          <span>{formatBrl(max)}</span>
        </div>
      </div>
    </section>
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
    <div className="card-detail-attribute flex gap-3 rounded-[18px] border border-line/80 bg-white/70 p-3 shadow-sm dark:bg-zinc-900/50 dark:border-white/10">
      <div className="detail-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lilac/10 text-violet-600 dark:bg-lilac/20 dark:text-lilac shadow-sm border border-line/40 dark:border-white/5">
        {icon}
      </div>
      <div className="min-w-0">
        <dt className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-sm font-black text-ink dark:text-white">
          {value}
        </dd>
      </div>
    </div>
  );
}

function getLanguageFlag(language: string): string {
  switch (language) {
    case "pt-BR":
      return "🇧🇷";
    case "en":
      return "🇺🇸";
    case "ja":
      return "🇯🇵";
    default:
      return "🏳️";
  }
}
