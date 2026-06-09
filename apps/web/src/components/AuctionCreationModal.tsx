import { useState } from "react";
import { createPortal } from "react-dom";
import { Gavel, X } from "lucide-react";
import type { CollectionItem } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { type AppRoute } from "../pages/App";
import { withAuthRetry } from "../lib/authRetry";
import { Button } from "./ui/Button";

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

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center bg-night/60 px-4 py-6 backdrop-blur-md" onMouseDown={onClose}>
      <div
        className="animate-soft-pop w-full max-w-lg overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-card"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line/70 px-6 py-5">
          <div className="flex items-center gap-3">
             <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400 text-white">
                <Gavel size={20} />
             </div>
             <div>
                <h2 className="text-xl font-black text-ink">Criar Leilão</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{item.card.name}</p>
             </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-slate-700 transition hover:bg-field"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
               <span className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">Lance Mínimo</span>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400">R$</span>
                 <input
                   className="premium-input pl-10"
                   type="number"
                   step="0.01"
                   required
                   value={minBid}
                   onChange={(e) => setMinBid(e.target.value)}
                 />
               </div>
            </label>

            <label className="grid gap-2">
               <span className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">Duração (Dias)</span>
               <select 
                 className="premium-select"
                 value={durationDays}
                 onChange={(e) => setDurationDays(e.target.value)}
               >
                 <option value="1">1 Dia</option>
                 <option value="3">3 Dias</option>
                 <option value="5">5 Dias</option>
                 <option value="7">7 Dias</option>
                 <option value="15">15 Dias</option>
               </select>
            </label>
          </div>

          <label className="grid gap-2">
             <span className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">Título do Leilão (Opcional)</span>
             <input
               className="premium-input"
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               placeholder="Ex: Charizard Base Set NM - Oportunidade!"
             />
          </label>

          <label className="grid gap-2">
             <span className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">Descrição Adicional</span>
             <textarea
               className="premium-input min-h-[100px] py-4"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder="Detalhes sobre o estado da carta, envio, etc..."
             />
          </label>

          {error && (
            <div className="danger-note p-4 flex flex-col gap-3">
              <p>{error}</p>
              {error.includes("WhatsApp") && (
                <Button
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

          <div className="pt-2">
            <Button
              type="submit"
              variant="brand"
              className="w-full h-14 bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-glow shadow-amber-500/20"
              disabled={submitting}
            >
              {submitting ? "Iniciando..." : "Iniciar Leilão Agora"}
            </Button>
            <p className="mt-4 text-[10px] font-bold text-center text-slate-400 uppercase tracking-wider">
               Ao iniciar, você receberá um link público para compartilhar.
            </p>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
