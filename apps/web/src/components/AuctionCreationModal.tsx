import { useState } from "react";
import { Gavel } from "lucide-react";
import type { CollectionItem } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { type AppRoute } from "../pages/App";
import { withAuthRetry } from "../lib/authRetry";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";

type Props = {
  item: CollectionItem;
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onClose: () => void;
  onCreated: (shareToken: string) => void;
  onNavigate: (route: AppRoute) => void;
};

export function AuctionCreationModal({ item, session, onSession, onUnauthorized, onClose, onCreated, onNavigate }: Props) {
  const [minBid, setMinBid] = useState(String(item.store?.effectivePrice ?? item.price?.amount ?? 0));
  const [durationDays, setDurationDays] = useState("7");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!session.user.whatsapp) {
      setError("Você precisa cadastrar seu WhatsApp no seu perfil para iniciar leilões.");
      return;
    }

    setError(null);
    setSubmitting(true);

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + Number(durationDays));

    try {
      const auction = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.createAuction(token, {
          collectionItemId: item.id,
          title: title || undefined,
          description: description || undefined,
          minBidBrl: Number(minBid),
          endsAt: endsAt.toISOString(),
        }),
      );
      onCreated(auction.shareToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar leilão");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal 
      title="Novo Leilão" 
      subtitle="Configure os detalhes do seu anúncio"
      icon={<Gavel size={20} />}
      onClose={onClose}
      maxWidthClass="max-w-xl"
      footer={(
        <div className="flex flex-col gap-4">
          <Button
            form="auction-form"
            type="submit"
            variant="brand"
            className="w-full h-14 bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-glow shadow-amber-500/20"
            disabled={submitting}
          >
            {submitting ? "Iniciando..." : "Iniciar Leilão Agora"}
          </Button>
          <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-wider">
             Ao iniciar, você receberá um link público para compartilhar.
          </p>
        </div>
      )}
    >
      <div className="p-6">
          {error && (
            <div className="p-4 mb-4 rounded-2xl bg-red-50 border border-red-100 flex flex-col gap-3">
              <p className="text-red-600 text-sm font-bold">{error}</p>
              {error.includes("WhatsApp") && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => {
                    onClose();
                    onNavigate({ view: "profile" });
                  }}
                >
                  Ir para o Perfil
                </Button>
              )}
            </div>
          )}
        <form id="auction-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-start gap-6 p-5 rounded-3xl bg-slate-50 border border-line shadow-sm">
            <div className="aspect-[3/4] w-24 overflow-hidden rounded-xl bg-white shadow-sm">
              <img src={item.card.imageSmall || undefined} alt={item.card.name} className="h-full w-full object-contain" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-ink">{item.card.name}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-2 py-1 rounded-lg bg-white border border-line text-[10px] font-black text-slate-500 uppercase">{item.condition}</span>
                <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-600 uppercase">{item.variant}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Lance Mínimo (R$)</span>
              <input
                type="number"
                step="0.01"
                className="premium-input"
                value={minBid}
                onChange={(e) => setMinBid(e.target.value)}
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Duração (Dias)</span>
              <select
                className="premium-select"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
              >
                <option value="1">1 dia</option>
                <option value="3">3 dias</option>
                <option value="5">5 dias</option>
                <option value="7">7 dias</option>
                <option value="15">15 dias</option>
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Título (Opcional)</span>
            <input
              type="text"
              className="premium-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Charizard Base Set NM"
            />
          </label>

          <label className="grid gap-2">
            <span className="px-1 text-xs font-black uppercase tracking-widest text-slate-500">Descrição (Opcional)</span>
            <textarea
              className="premium-input min-h-24 resize-none py-4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais sobre o estado da carta..."
            />
          </label>
        </form>
      </div>
    </Modal>
  );
}
