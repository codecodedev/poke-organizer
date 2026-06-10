import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Swords,
  Trash2,
  X,
} from "lucide-react";
import {
  type CollectionItem,
  type DeckAiAnalysis,
  type DeckCard,
  type DeckDetail,
  type DeckFormat,
  type DeckGenerationMode,
  type DeckSuggestion,
  formatCardNumber,
  normalizeSearchText,
} from "@poke-organizer/shared";
import { api, type Session } from "../../lib/api";
import { withAuthRetry } from "../../lib/authRetry";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Panel } from "../ui/Panel";
import { ConfirmationModal } from "../ui/ConfirmationModal";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
};

type DraftDeckCard = {
  card: DeckCard["card"];
  quantity: number;
  source: DeckCard["source"];
};

export function DecksPage({ session, onSession, onUnauthorized }: Props) {
  const [decks, setDecks] = useState<DeckDetail[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<DeckDetail | null>(null);
  const [draftCards, setDraftCards] = useState<DraftDeckCard[]>([]);
  const [inventory, setInventory] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<DeckAiAnalysis | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showGenerator, setShowGenerator] = useState(false);
  const [deckToRemove, setDeckToRemove] = useState<DeckDetail | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [nextDecks, nextInventory] = await Promise.all([
        withAuthRetry(session, onSession, onUnauthorized, (token) =>
          api.listDecks(token),
        ),
        withAuthRetry(session, onSession, onUnauthorized, (token) =>
          api.listCollection(token),
        ),
      ]);
      const details = await Promise.all(
        nextDecks.map((deck) =>
          withAuthRetry(session, onSession, onUnauthorized, (token) =>
            api.getDeck(token, deck.id),
          ),
        ),
      );
      setDecks(details);
      setInventory(nextInventory);
      if (selectedDeck) {
        const refreshed = details.find((deck) => deck.id === selectedDeck.id);
        if (refreshed) selectDeck(refreshed);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const inventoryTypes = useMemo(
    () => Array.from(new Set(inventory.flatMap((item) => item.card.types))).sort(),
    [inventory],
  );

  const inventoryByCardId = useMemo(() => {
    const map = new Map<string, number>();
    inventory.forEach((item) => {
      map.set(item.card.id, (map.get(item.card.id) ?? 0) + item.quantity);
    });
    return map;
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    const normalized = normalizeSearchText(query);
    return inventory.filter((item) => {
      const cardText = normalizeSearchText(
        `${item.card.name} ${item.card.number} ${item.card.setName ?? ""}`,
      );
      if (normalized && !cardText.includes(normalized)) return false;
      if (typeFilter && !item.card.types.includes(typeFilter)) return false;
      return true;
    });
  }, [inventory, query, typeFilter]);

  const totalCards = draftCards.reduce((sum, item) => sum + item.quantity, 0);
  const cardsToComplete = Math.max(0, 60 - totalCards);
  const missingCards = draftCards
    .filter((item) => item.source === "missing")
    .reduce((sum, item) => sum + item.quantity, 0);

  function selectDeck(deck: DeckDetail) {
    setSelectedDeck(deck);
    setAiAnalysis(null);
    setDraftCards(
      deck.cards.map((item) => ({
        card: item.card,
        quantity: item.quantity,
        source: item.source,
      })),
    );
  }

  async function createDeck() {
    const deck = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.createDeck(token, {
        name: `Deck ${decks.length + 1}`,
        format: "standard",
        generationMode: "owned-only",
      }),
    );
    setDecks((current) => [deck, ...current]);
    selectDeck(deck);
  }

  async function deleteDeck(deck: DeckDetail) {
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.deleteDeck(token, deck.id),
    );
    setDecks((current) => current.filter((item) => item.id !== deck.id));
    if (selectedDeck?.id === deck.id) {
      setSelectedDeck(null);
      setDraftCards([]);
    }
  }

  async function saveDeck() {
    if (!selectedDeck) return null;
    setSaving(true);
    try {
      const saved = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateDeck(token, selectedDeck.id, {
          name: selectedDeck.name,
          format: selectedDeck.format,
          generationMode: selectedDeck.generationMode,
          archetypeId: null,
          cards: draftCards.map((item) => ({
            cardId: item.card.id,
            quantity: item.quantity,
            source: item.source,
          })),
        }),
      );
      setDecks((current) =>
        current.map((deck) => (deck.id === saved.id ? saved : deck)),
      );
      selectDeck(saved);
      return saved;
    } finally {
      setSaving(false);
    }
  }

  async function validateDeck() {
    if (!selectedDeck) return;
    await saveDeck();
    const validation = await withAuthRetry(
      session,
      onSession,
      onUnauthorized,
      (token) => api.validateDeck(token, selectedDeck.id),
    );
    setSelectedDeck((current) => (current ? { ...current, validation } : current));
  }

  async function analyzeWithAi() {
    if (!selectedDeck) return;
    setAiLoading(true);
    try {
      const saved = await saveDeck();
      const deckId = saved?.id ?? selectedDeck.id;
      const analysis = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.analyzeDeckWithAi(token, deckId),
      );
      setAiAnalysis(analysis);
    } finally {
      setAiLoading(false);
    }
  }

  function addInventoryCard(item: CollectionItem) {
    setDraftCards((current) => {
      const available = inventoryByCardId.get(item.card.id) ?? item.quantity;
      const existing = current.find(
        (entry) => entry.card.id === item.card.id && entry.source === "owned",
      );
      if (existing) {
        return current.map((entry) =>
          entry === existing
            ? { ...entry, quantity: Math.min(available, entry.quantity + 1) }
            : entry,
        );
      }
      return [...current, { card: item.card, quantity: 1, source: "owned" }];
    });
  }

  function updateDraftCard(cardId: string, source: DeckCard["source"], quantity: number) {
    setDraftCards((current) =>
      current
        .map((item) =>
          item.card.id === cardId && item.source === source
            ? { ...item, quantity: Math.max(1, quantity) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function removeDraftCard(cardId: string, source: DeckCard["source"]) {
    setDraftCards((current) =>
      current.filter((item) => !(item.card.id === cardId && item.source === source)),
    );
  }

  async function saveSuggestion(suggestion: DeckSuggestion) {
    const saved = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.createDeck(token, {
        name: `${suggestion.archetype.name} baseado no inventario`,
        format: suggestion.format,
        generationMode: suggestion.mode,
        archetypeId: suggestion.archetype.id,
        cards: mergeSuggestionCards(suggestion).map((item) => ({
          cardId: item.card.id,
          quantity: item.quantity,
          source: item.source,
        })),
      }),
    );
    setDecks((current) => [saved, ...current]);
    selectDeck(saved);
    setShowGenerator(false);
  }

  return (
    <>
      {!selectedDeck && (
        <Panel
          title="Decks de batalha"
          description="Monte decks de 60 cartas, valide regras e gere sugestoes com base no seu inventario."
          action={
            <div className="ml-auto flex flex-wrap gap-2">
              <Button type="button" icon={<Bot size={16} />} onClick={() => setShowGenerator(true)}>
                Gerar deck
              </Button>
              <Button type="button" icon={<Plus size={16} />} onClick={() => void createDeck()}>
                Criar deck
              </Button>
              <Button type="button" icon={<RefreshCw size={16} />} onClick={() => void load()}>
                Recarregar
              </Button>
            </div>
          }
        >
          {loading && <p className="section-copy">Carregando decks...</p>}

          {!loading && decks.length === 0 && (
            <p className="warning-note">
              Voce ainda nao tem decks. Crie um deck manual ou gere uma sugestao automaticamente.
            </p>
          )}

          {decks.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {decks.map((deck) => (
                <article
                  key={deck.id}
                  className="soft-card cursor-pointer p-4"
                  onClick={() => selectDeck(deck)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-ink">{deck.name}</h3>
                      <p className="section-copy">
                        {formatDeckFormat(deck.format)} - {deck.totalCards}/60 cartas
                      </p>
                    </div>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-2xl border border-line bg-white/80 text-slate-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeckToRemove(deck);
                      }}
                      aria-label="Excluir deck"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusChip valid={deck.validationStatus === "valid"} />
                    {deck.missingCards > 0 && (
                      <span className="chip">{deck.missingCards} fora do inventario</span>
                    )}
                    {deck.archetypeName && <span className="chip">{deck.archetypeName}</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      )}

      {selectedDeck && (
        <Panel
          title={selectedDeck.name}
          description="Edite cartas do deck e valide contra as regras do formato."
          action={
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<ArrowLeft size={16} />}
                onClick={() => {
                  setSelectedDeck(null);
                  setDraftCards([]);
                }}
              >
                Voltar para decks
              </Button>
              <Button type="button" icon={<CheckCircle2 size={16} />} onClick={() => void validateDeck()}>
                Validar
              </Button>
              <Button type="button" icon={<Bot size={16} />} disabled={aiLoading || saving} onClick={() => void analyzeWithAi()}>
                {aiLoading ? "Analisando" : "Analisar com IA"}
              </Button>
              <Button type="button" variant="primary" icon={<Save size={16} />} disabled={saving} onClick={() => void saveDeck()}>
                {saving ? "Salvando" : "Salvar deck"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-black text-slate-700">
                  Nome
                  <input
                    className="premium-input mt-2 w-full"
                    value={selectedDeck.name}
                    onChange={(event) =>
                      setSelectedDeck((current) =>
                        current ? { ...current, name: event.target.value } : current,
                      )
                    }
                  />
                </label>
                <label className="text-sm font-black text-slate-700">
                  Formato
                  <select
                    className="premium-select mt-2 w-full"
                    value={selectedDeck.format}
                    onChange={(event) =>
                      setSelectedDeck((current) =>
                        current ? { ...current, format: event.target.value as DeckFormat } : current,
                      )
                    }
                  >
                    <option value="standard">Standard</option>
                    <option value="casual">Casual</option>
                  </select>
                </label>
                <label className="text-sm font-black text-slate-700">
                  Modo
                  <select
                    className="premium-select mt-2 w-full"
                    value={selectedDeck.generationMode}
                    onChange={(event) =>
                      setSelectedDeck((current) =>
                        current ? { ...current, generationMode: event.target.value as DeckGenerationMode } : current,
                      )
                    }
                  >
                    <option value="owned-only">Somente minhas cartas</option>
                    <option value="allow-missing">Permitir faltantes</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 rounded-[22px] border border-line/70 bg-field/45 p-4 sm:grid-cols-4">
                <Stat label="Cartas" value={`${totalCards}/60`} />
                <Stat label="Para 60" value={String(cardsToComplete)} />
                <Stat label="Fora inventario" value={String(missingCards)} />
                <Stat label="Status" value={selectedDeck.validation?.isValid ? "Valido" : "Pendente"} />
              </div>

              <DeckValidationPanel deck={selectedDeck} />
              {aiAnalysis && <DeckAiAnalysisPanel analysis={aiAnalysis} />}

              <div className="grid gap-2">
                {draftCards.length === 0 && (
                  <p className="warning-note">Adicione cartas do inventario para montar o deck.</p>
                )}
                {draftCards.map((item) => (
                  <div key={`${item.card.id}-${item.source}`} className="soft-card grid gap-3 p-3 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:items-center">
                    <img src={item.card.imageSmall ?? ""} alt={item.card.name} className="h-20 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <p className="font-black text-ink">{item.card.name}</p>
                      <p className="section-copy">
                        {formatCardNumber(item.card.number, item.card.printedTotal)} - {item.card.setName ?? "Colecao nao informada"}
                      </p>
                      <span className="chip mt-2">{item.source === "missing" ? "Faltante" : "Inventario"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        className="premium-input w-20"
                        type="number"
                        min={1}
                        max={60}
                        value={item.quantity}
                        onChange={(event) =>
                          updateDraftCard(item.card.id, item.source, Number(event.target.value))
                        }
                      />
                      <button
                        type="button"
                        className="grid h-11 w-11 place-items-center rounded-2xl border border-line bg-white/80 text-slate-600"
                        onClick={() => removeDraftCard(item.card.id, item.source)}
                        aria-label="Remover carta do deck"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="grid content-start gap-3">
              <h3 className="text-lg font-black text-ink">Adicionar cartas</h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  className="premium-input w-full pl-11 pr-11"
                  value={query}
                  placeholder="Nome, numero ou colecao"
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <select className="premium-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Todos os tipos</option>
                {inventoryTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
              <div className="max-h-[560px] overflow-auto rounded-[22px] border border-line/70">
                {filteredInventory.slice(0, 80).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center gap-3 border-b border-line/60 px-3 py-2 text-left transition hover:bg-aqua/10"
                    onClick={() => addInventoryCard(item)}
                  >
                    <img src={item.card.imageSmall ?? ""} alt={item.card.name} className="h-14 w-10 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{item.card.name}</span>
                      <span className="section-copy block truncate">x{item.quantity} - {item.card.setName ?? "Sem colecao"}</span>
                    </span>
                    <Plus size={16} />
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </Panel>
      )}

      {showGenerator && (
        <DeckGeneratorModal
          session={session}
          onSession={onSession}
          onUnauthorized={onUnauthorized}
          onClose={() => setShowGenerator(false)}
          onSaveSuggestion={saveSuggestion}
        />
      )}

      {deckToRemove && (
        <ConfirmationModal
          title="Excluir deck"
          description={`Tem certeza que deseja excluir o deck "${deckToRemove.name}"?`}
          confirmLabel="Excluir"
          onConfirm={() => {
            void deleteDeck(deckToRemove);
            setDeckToRemove(null);
          }}
          onCancel={() => setDeckToRemove(null)}
        />
      )}
    </>
  );
}

function DeckGeneratorModal({
  session,
  onSession,
  onUnauthorized,
  onClose,
  onSaveSuggestion,
}: Props & {
  onClose: () => void;
  onSaveSuggestion: (suggestion: DeckSuggestion) => Promise<void>;
}) {
  const [format, setFormat] = useState<DeckFormat>("standard");
  const [mode, setMode] = useState<DeckGenerationMode>("owned-only");
  const [suggestions, setSuggestions] = useState<DeckSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const next = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.generateBestDeck(token, { format, mode, maxSuggestions: 3 }),
      );
      setSuggestions(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Gerar melhor deck"
      subtitle="O algoritmo compara seu inventario com arquetipos curados e retorna ate 3 sugestoes."
      icon={<Bot size={20} />}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
    >
      <div className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-black text-slate-700">
            Formato
            <select className="premium-select mt-2 w-full" value={format} onChange={(event) => setFormat(event.target.value as DeckFormat)}>
              <option value="standard">Standard</option>
              <option value="casual">Casual</option>
            </select>
          </label>
          <label className="text-sm font-black text-slate-700">
            Modo
            <select className="premium-select mt-2 w-full" value={mode} onChange={(event) => setMode(event.target.value as DeckGenerationMode)}>
              <option value="owned-only">Somente minhas cartas</option>
              <option value="allow-missing">Permitir faltantes</option>
            </select>
          </label>
          <Button type="button" variant="primary" className="self-end" icon={<Bot size={16} />} disabled={loading} onClick={() => void generate()}>
            {loading ? "Gerando" : "Gerar"}
          </Button>
        </div>

        {suggestions.length === 0 && !loading && (
          <p className="warning-note">Escolha as opcoes e gere sugestoes com base no inventario atual.</p>
        )}

        <div className="grid gap-3">
          {suggestions.map((suggestion) => {
            const suggestionCards = mergeSuggestionCards(suggestion);
            const totalSuggestionCards = suggestionCards.reduce((sum, item) => sum + item.quantity, 0);
            const missingSuggestionCards = suggestionCards
              .filter((item) => item.source === "missing")
              .reduce((sum, item) => sum + item.quantity, 0);

            return (
              <article key={suggestion.archetype.id} className="soft-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-ink">{suggestion.archetype.name}</h3>
                    <p className="section-copy">{suggestion.explanation}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="chip">{suggestion.compatibility}% compatibilidade</span>
                    <span className="chip">{totalSuggestionCards}/60 cartas para salvar</span>
                    {missingSuggestionCards > 0 && <span className="chip">{missingSuggestionCards} fora do inventario</span>}
                  </div>
                </div>

                {suggestion.missingCards.length > 0 && (
                  <div className="warning-note mt-3">
                    Fora do inventario: {suggestion.missingCards.map((item) => `${item.quantity}x ${item.cardName}`).join(", ")}
                  </div>
                )}

                <div className="mt-3 max-h-[440px] overflow-auto rounded-[22px] border border-line/70 p-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {suggestionCards.map((item) => (
                      <div key={`${item.card.id}-${item.source}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 rounded-2xl border border-line/70 bg-field/55 p-2">
                        {item.card.imageSmall ? (
                          <img src={item.card.imageSmall} alt={item.card.name} className="h-14 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-14 w-10 rounded-lg bg-slate-200" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-ink">{item.quantity}x {item.card.name}</p>
                          <p className="section-copy truncate text-xs">
                            {item.source === "missing" ? "Fora do inventario" : "Inventario"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <Button type="button" variant="primary" icon={<Save size={16} />} onClick={() => void onSaveSuggestion(suggestion)}>
                    Salvar {totalSuggestionCards} cartas como deck
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function DeckValidationPanel({ deck }: { deck: DeckDetail }) {
  const validation = deck.validation;
  if (!validation) {
    return <p className="warning-note">Salve ou valide o deck para ver os avisos de regras.</p>;
  }

  if (validation.issues.length === 0) {
    return (
      <p className="success-note">
        Deck valido: {validation.totalCards}/60 cartas e nenhuma regra quebrada.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {validation.issues.map((issue, index) => (
        <p key={`${issue.code}-${index}`} className={issue.severity === "error" ? "danger-note" : "warning-note"}>
          {issue.severity === "error" ? <ShieldAlert className="mr-2 inline" size={16} /> : null}
          {issue.message}
        </p>
      ))}
    </div>
  );
}

function DeckAiAnalysisPanel({ analysis }: { analysis: DeckAiAnalysis }) {
  return (
    <section className="soft-card grid gap-4 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Analise com IA</p>
          <span className="chip">{formatAiProvider(analysis.provider)}</span>
          {analysis.fallbackUsed && <span className="warning-note inline-flex py-1 text-xs">Fallback local</span>}
        </div>
        <h3 className="mt-1 text-xl font-black text-ink">Estrategia e melhorias</h3>
        <p className="section-copy mt-1">{analysis.summary}</p>
        {analysis.fallbackUsed && (
          <p className="warning-note mt-3">
            Usei a analise local porque a IA externa nao esta configurada ou nao respondeu.
          </p>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <AiList title="Plano de jogo" items={analysis.strategy} />
        <AiList title="Dicas de partida" items={analysis.playTips} />
        <AiList title="Pontos fortes" items={analysis.strengths} />
        <AiList title="Pontos fracos" items={analysis.weaknesses} />
      </div>

      <AiList title="Melhorias recomendadas" items={analysis.improvements} />

      {analysis.suggestedChanges.length > 0 && (
        <div>
          <h4 className="font-black text-ink">Ajustes de lista</h4>
          <div className="mt-2 grid gap-2">
            {analysis.suggestedChanges.map((change, index) => (
              <div key={`${change.cardName}-${change.action}-${index}`} className="rounded-2xl border border-line/70 bg-field/55 p-3">
                <p className="font-black text-ink">
                  {formatAiAction(change.action)} {change.quantity}x {change.cardName}
                  {!change.owned && <span className="ml-2 chip">fora do inventario</span>}
                </p>
                <p className="section-copy mt-1">{change.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="section-copy text-xs">
        Gerado por {analysis.model} em {new Date(analysis.generatedAt).toLocaleString("pt-BR")}. Revise antes de aplicar.
      </p>
    </section>
  );
}

function AiList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="font-black text-ink">{title}</h4>
      <ul className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="section-copy rounded-2xl border border-line/60 bg-field/45 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatAiProvider(provider: DeckAiAnalysis["provider"]) {
  const labels = {
    gemini: "Gemini Free",
    openai: "OpenAI",
    local: "Analise local",
  } satisfies Record<DeckAiAnalysis["provider"], string>;

  return labels[provider];
}

function formatAiAction(action: DeckAiAnalysis["suggestedChanges"][number]["action"]) {
  const labels = {
    add: "Adicionar",
    remove: "Remover",
    increase: "Aumentar",
    decrease: "Reduzir",
  } satisfies Record<DeckAiAnalysis["suggestedChanges"][number]["action"], string>;

  return labels[action];
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-ink">{value}</p>
    </div>
  );
}

function StatusChip({ valid }: { valid: boolean }) {
  return (
    <span className={valid ? "success-note inline-flex py-1" : "warning-note inline-flex py-1"}>
      {valid ? <CheckCircle2 size={14} /> : <Swords size={14} />}
      {valid ? "Valido" : "Pendente"}
    </span>
  );
}

function formatDeckFormat(format: DeckFormat) {
  return format === "standard" ? "Standard" : "Casual";
}

function mergeSuggestionCards(suggestion: DeckSuggestion) {
  const grouped = new Map<string, DeckSuggestion["cards"][number]>();
  suggestion.cards.forEach((item) => {
    const key = `${item.card.id}:${item.source}`;
    const current = grouped.get(key);
    grouped.set(key, current ? { ...current, quantity: current.quantity + item.quantity } : item);
  });
  return Array.from(grouped.values());
}
