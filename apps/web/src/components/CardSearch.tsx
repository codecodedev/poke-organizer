import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { formatCardNumber, type CardSummary } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { CardDetailModal, type AddCardDetails } from "./CardDetailModal";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { PaginationControls } from "./ui/PaginationControls";

const SEARCH_PAGE_SIZE = 12;

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onAdded: () => void;
};

export function CardSearch({ session, onSession, onUnauthorized, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [number, setNumber] = useState("");
  const [cards, setCards] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardSummary | null>(null);
  const [page, setPage] = useState(1);
  const lastRequestRef = useRef(0);

  const hasSearchInput = useMemo(() => query.trim().length > 0 || number.trim().length > 0, [query, number]);
  const paginatedCards = useMemo(() => cards.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE), [cards, page]);

  async function search(event?: FormEvent) {
    event?.preventDefault();
    if (!hasSearchInput) {
      setCards([]);
      setError(null);
      return;
    }

    const requestId = Date.now();
    lastRequestRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const results = await api.searchCards({
        query: query.trim() || undefined,
        number: number.trim() || undefined
      });
      if (lastRequestRef.current === requestId) {
        setCards(results);
        setPage(1);
      }
    } catch (err) {
      if (lastRequestRef.current === requestId) {
        setError(err instanceof Error ? err.message : "Falha na busca");
      }
    } finally {
      if (lastRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }

  async function addDetailsAndClose(details: AddCardDetails) {
    const result = await withAuthRetry(session, onSession, onUnauthorized, (token) => api.addCollection(token, details));
    setSelectedCard(null);
    setAddFeedback(
      result.action === "incremented"
        ? `${result.item.card.name} ja existia com estes atributos; quantidade incrementada.`
        : `${result.item.card.name} adicionada a colecao.`
    );
    onAdded();
    return result;
  }

  useEffect(() => {
    if (!hasSearchInput) {
      setCards([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void search();
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [query, number, hasSearchInput]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(cards.length / SEARCH_PAGE_SIZE));
    setPage((current) => Math.min(current, totalPages));
  }, [cards.length]);

  return (
    <Panel title="Buscar cartas" description="Digite nome, numero ou combine os dois para encontrar sugestoes.">
      <form onSubmit={search} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
        <input
          className="premium-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nome da carta, opcional"
        />
        <input
          className="premium-input"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          placeholder="150/217"
        />
        <Button type="submit" variant="primary" icon={<Search size={18} />}>
          {loading ? "Buscando" : "Buscar"}
        </Button>
      </form>

      {error && <p className="danger-note mt-3">{error}</p>}
      {addFeedback && <p className="success-note mt-3">{addFeedback}</p>}

      {hasSearchInput && !error && (
        <div className="mt-3 rounded-2xl border border-line/80 bg-white/60 px-4 py-3 text-sm font-semibold text-slate-600">
          {loading
            ? "Buscando sugestoes..."
            : cards.length > 0
              ? `${cards.length} sugestoes encontradas`
              : "Nenhuma sugestao encontrada"}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {paginatedCards.map((card) => (
          <article
            key={card.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedCard(card)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setSelectedCard(card);
              }
            }}
            className="soft-card grid cursor-pointer grid-cols-[82px_1fr] gap-3 p-3"
          >
            <div className="aspect-[5/7] overflow-hidden rounded-2xl bg-gradient-to-br from-aqua/15 to-lilac/15 shadow-sm">
              {card.imageSmall && <img className="h-full w-full object-cover transition duration-300 hover:scale-105" src={card.imageSmall} alt={card.name} />}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-ink">{card.name}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {formatCardNumber(card.number, card.printedTotal)}
                {card.setName ? ` - ${card.setName}` : ""}
              </p>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedCard(card);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:border-brand/40"
              >
                <Plus size={16} />
                Adicionar
              </button>
            </div>
          </article>
        ))}
      </div>

      <PaginationControls
        page={page}
        pageSize={SEARCH_PAGE_SIZE}
        totalItems={cards.length}
        onPageChange={setPage}
        itemLabel="sugestoes"
      />

      <CardDetailModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onAdd={addDetailsAndClose}
      />
    </Panel>
  );
}
