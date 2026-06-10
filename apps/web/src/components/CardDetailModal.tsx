import { FormEvent, useEffect, useState, type ReactNode } from "react";
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
import { formatBrl } from "../lib/format";
import { CardVariantImage } from "./collection/CardVariantImage";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

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
  onClose,
}: Props) {
  const card = detailCard || collectionItem?.card;
  const price = detailPrice || collectionPrice || collectionItem?.price;
  const mode = initialMode || (collectionItem ? "edit" : "add");

  const [quantity, setQuantity] = useState(collectionItem?.quantity ?? 1);
  const [condition, setCondition] = useState<CardCondition>(collectionItem?.condition ?? "NM");
  const [variant, setVariant] = useState(collectionItem?.variant ?? initialVariant ?? "normal");
  const [language, setLanguage] = useState<CardLanguage>(collectionItem?.language ?? "pt-BR");
  const [notes, setNotes] = useState(collectionItem?.notes ?? "");
  const [customPrice, setCustomPrice] = useState<number | null>(collectionItem?.customPrice ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  useEffect(() => {
    if (collectionItem) {
      setQuantity(collectionItem.quantity);
      setCondition(collectionItem.condition);
      setVariant(collectionItem.variant);
      setLanguage(collectionItem.language);
      setNotes(collectionItem.notes ?? "");
      setCustomPrice(collectionItem.customPrice ?? null);
    }
  }, [collectionItem]);

  if (!card) return null;

  const fullNumber = formatCardNumber(card.number, card.printedTotal);
  const variants = card.variants.length > 0 ? card.variants : ["normal"];

  const priceDisplay = price?.amount !== null && price?.amount !== undefined
    ? formatBrl(price.amount)
    : "Valor não encontrado";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!onAdd && (!collectionItem || !onUpdate)) return;

    setSubmitting(true);
    setError(null);
    setSubmitMessage(null);

    try {
      const details = {
        quantity,
        condition,
        variant,
        foil: variant !== "normal",
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
          setSubmitMessage("Quantidade incrementada.");
        } else {
          setSubmitMessage("Carta adicionada.");
        }
      } else if (collectionItem && onUpdate) {
        await onUpdate(collectionItem.id, details);
        setSubmitMessage("Alterações salvas.");
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
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estimativa atual</p>
                <p className="text-xl font-black text-ink">{priceDisplay}</p>
             </div>
          </div>
          <div className="flex gap-3">
            {collectionItem && onStartAuction && (
              <Button
                type="button"
                variant="ghost"
                className="px-6 text-slate-600 border border-line"
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
              className="px-12 py-3 shadow-glow"
              disabled={submitting}
              icon={mode === "add" ? <Plus size={20} /> : <Save size={20} />}
            >
              {submitting ? "Salvando..." : mode === "add" ? "Adicionar" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : null}
    >
      <div className={`grid gap-8 p-6 ${showRightColumn ? 'lg:grid-cols-[1fr_400px]' : ''}`}>
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

          <h3 className="mb-3 text-xl font-black text-ink uppercase tracking-widest text-[14px]">Atributos</h3>
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
              icon={<Tag size={18} />}
              label="Coleção"
              value={card.setName ?? "Não informado"}
            />
          </dl>
        </div>

        {showRightColumn && (
          <aside className="lg:sticky lg:top-0">
            <div className="rounded-[32px] border border-line/80 bg-white/70 p-6 shadow-sm">
              <form id="card-detail-form" onSubmit={submit}>
                <h3 className="text-xl font-black text-ink uppercase tracking-widest text-[14px] mb-6">
                  {mode === "add" ? "Configurar Adição" : "Editar Entrada"}
                </h3>

                <div className="grid gap-5">
                  <label className="grid gap-2">
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade</span>
                    <input
                      type="number"
                      min="1"
                      className="premium-input"
                      value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, parseInt(event.target.value) || 1))}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Condição</span>
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
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Variante</span>
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
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Idioma</span>
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

                  <label className="grid gap-2">
                    <span className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Preço Manual (Opcional)</span>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
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

                {(error || submitMessage) && (
                  <div className={`mt-6 p-4 rounded-2xl text-[11px] font-black uppercase tracking-wider text-center ${error ? 'bg-red-50 border border-red-100 text-red-600' : 'bg-green-50 border border-green-100 text-green-600'}`}>
                    {error || submitMessage}
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
    <div className="rounded-2xl border border-line/60 bg-white/50 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="truncate text-xs font-bold text-ink">{value}</p>
    </div>
  );
}
