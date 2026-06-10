import { useState, useEffect } from "react";
import { Gavel, Search, X } from "lucide-react";
import type { CollectionItem } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { type AppRoute } from "../pages/App";
import { withAuthRetry } from "../lib/authRetry";
import { AuctionCreationModal } from "./AuctionCreationModal";
import { Modal } from "./ui/Modal";
import { MarketAuctionCard } from "./collection/MarketAuctionCard";

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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            className="premium-input pl-12 pr-11"
            placeholder="Buscar na sua coleção..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="py-12 text-center font-bold text-muted-foreground">Carregando sua coleção...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground font-bold border-2 border-dashed border-card-border rounded-2xl">
              Nenhuma carta encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <MarketAuctionCard
                  key={item.id}
                  name={item.card.name}
                  image={item.card.imageSmall || ""}
                  condition={item.condition}
                  variant={item.variant}
                  number={`${item.card.number}/${item.card.printedTotal}`}
                  collectionCode={item.card.setCode}
                  collectionName={item.card.setName}
                  onClick={() => {
                    setSelectedItem(item);
                    setStep("form");
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
