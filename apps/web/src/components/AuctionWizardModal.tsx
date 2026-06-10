import { useState, useEffect } from "react";
import { Gavel, Search } from "lucide-react";
import type { CollectionItem } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { type AppRoute } from "../pages/App";
import { withAuthRetry } from "../lib/authRetry";
import { AuctionCreationModal } from "./AuctionCreationModal";
import { Modal } from "./ui/Modal";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onClose: () => void;
  onCreated: (shareToken: string) => void;
  onNavigate: (route: AppRoute) => void;
};

export function AuctionWizardModal({ session, onSession, onUnauthorized, onClose, onCreated, onNavigate }: Props) {
  const [step, setStep] = useState<"search" | "form">("search");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
          api.listCollection(token),
        );
        setItems(data);
      } catch (err) {
        console.error("Failed to load collection", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session]);

  const filteredItems = items.filter((item) =>
    item.card.name.toLowerCase().includes(search.toLowerCase()) ||
    item.card.number.toLowerCase().includes(search.toLowerCase())
  );

  if (step === "form" && selectedItem) {
    return (
      <AuctionCreationModal
        item={selectedItem}
        session={session}
        onSession={onSession}
        onUnauthorized={onUnauthorized}
        onClose={() => setStep("search")}
        onCreated={onCreated}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <Modal 
      title="Novo Leilão" 
      subtitle="Selecione uma carta da sua coleção"
      icon={<Gavel size={20} />}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
    >
      <div className="p-6 flex flex-col gap-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            className="premium-input pl-12"
            placeholder="Buscar na sua coleção..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center font-bold text-slate-500">Carregando sua coleção...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 font-bold border-2 border-dashed border-line rounded-2xl">
              Nenhuma carta encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    setStep("form");
                  }}
                  className="group relative flex flex-col items-center gap-2 rounded-2xl border border-line p-3 transition hover:border-amber-400 hover:shadow-md"
                >
                  <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-slate-50">
                    <img
                      src={item.card.imageSmall || undefined}
                      alt={item.card.name}
                      className="h-full w-full object-contain transition group-hover:scale-105"
                    />
                  </div>
                  <div className="w-full text-center">
                    <p className="truncate text-xs font-black text-ink">{item.card.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[9px] font-black text-slate-500 uppercase">{item.condition}</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-[9px] font-black text-amber-600 uppercase truncate max-w-[60px]">{item.variant}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
