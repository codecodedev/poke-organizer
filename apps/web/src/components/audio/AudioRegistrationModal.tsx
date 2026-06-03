import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Boxes, CircleHelp, Clock3, Globe2, Loader2, Mic, MicOff, Radio, Search, X } from "lucide-react";
import {
  DEFAULT_CARD_VARIANT,
  FOIL_CARD_VARIANT,
  HOLOFOIL_CARD_VARIANT,
  REVERSE_HOLO_CARD_VARIANT,
  formatCardNumber,
  formatCardVariant,
  type CardSetSummary,
  type CardSummary,
  type CollectionAddAction,
  type CollectionItem
} from "@poke-organizer/shared";
import { api, type Session } from "../../lib/api";
import { withAuthRetry } from "../../lib/authRetry";
import { formatBrl } from "../../lib/format";
import { parseGeneralSpokenCardNumber, parseSpecificSpokenNumber } from "../../lib/spokenNumbers";
import { CardDetailModal, type AddCardDetails } from "../CardDetailModal";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { MicVisualizer } from "./MicVisualizer";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onAdded: () => void;
  onClose: () => void;
};

type SearchMode = "set" | "general";
type MicState = "closed" | "listening" | "processing";
type VoiceCommand = {
  cardNumber: { number: number; printedTotal: number; fullNumber: string };
  setId?: string;
  requestedVariant: string | null;
  confirm: boolean;
};
type VoiceQueueStatus = "queued" | "running" | "error";
type VoiceQueueItem = {
  id: string;
  command: VoiceCommand;
  transcript: string;
  status: VoiceQueueStatus;
  canceled?: boolean;
  error?: string;
};
type AddedPreview = {
  id: string;
  item: CollectionItem;
  action: CollectionAddAction;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

export function AudioRegistrationModal({ session, onSession, onUnauthorized, onAdded, onClose }: Props) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const handledTranscriptRef = useRef(false);
  const processingQueueRef = useRef(false);
  const voiceQueueRef = useRef<VoiceQueueItem[]>([]);
  const canceledQueueIdsRef = useRef<Set<string>>(new Set());
  const currentPreviewRef = useRef<AddedPreview | null>(null);
  const previewQueueRef = useRef<AddedPreview[]>([]);
  const previewStartedAtRef = useRef(0);
  const previewMinTimerRef = useRef<number | null>(null);
  const previewHideTimerRef = useRef<number | null>(null);
  const [mode, setMode] = useState<SearchMode>("set");
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [setsLoading, setSetsLoading] = useState(false);
  const [micState, setMicState] = useState<MicState>("closed");
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardSummary | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [voiceQueue, setVoiceQueue] = useState<VoiceQueueItem[]>([]);
  const [lastAddedPreview, setLastAddedPreview] = useState<AddedPreview | null>(null);

  const selectedSet = useMemo(() => sets.find((set) => set.id === selectedSetId) ?? null, [selectedSetId, sets]);
  const speechSupported = Boolean(getSpeechRecognitionConstructor());
  const canStart = speechSupported && micState === "closed" && (mode === "general" || Boolean(selectedSet));

  useEffect(() => {
    if (mode !== "set" || sets.length > 0 || setsLoading) return;

    setSetsLoading(true);
    setFeedback(null);
    api
      .listCardSets()
      .then((items) => {
        setSets(items);
        setSelectedSetId((current) => current || items[0]?.id || "");
      })
      .catch((err) => {
        setFeedback(err instanceof Error ? err.message : "Nao foi possivel carregar as colecoes");
      })
      .finally(() => setSetsLoading(false));
  }, [mode, sets.length, setsLoading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      clearPreviewTimers();
    };
  }, []);

  useEffect(() => {
    voiceQueueRef.current = voiceQueue;
    if (voiceQueue.some((item) => item.status === "queued")) {
      void processVoiceQueue();
    }
  }, [voiceQueue]);

  function stopListening() {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setMicState("closed");
  }

  function changeMode(nextMode: SearchMode) {
    stopListening();
    setMode(nextMode);
    setTranscript("");
    setFeedback(null);
  }

  function startListening() {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setFeedback("Reconhecimento por voz nao esta disponivel neste navegador");
      return;
    }
    if (mode === "set" && !selectedSet) {
      setFeedback("Escolha uma colecao antes de abrir o microfone");
      return;
    }

    recognitionRef.current?.abort();
    handledTranscriptRef.current = false;
    setTranscript("");
    setFeedback(null);
    setMicState("listening");

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let nextTranscript = "";
      let hasFinalResult = false;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        nextTranscript += result[0].transcript;
        hasFinalResult = hasFinalResult || result.isFinal;
      }

      const cleanedTranscript = nextTranscript.trim();
      setTranscript(cleanedTranscript);

      if (!hasFinalResult || handledTranscriptRef.current) return;

      handledTranscriptRef.current = true;
      recognition.stop();
      void handleTranscript(cleanedTranscript);
    };
    recognition.onerror = (event) => {
      handledTranscriptRef.current = true;
      setMicState("closed");
      setFeedback(event.error === "no-speech" ? "Nao ouvi nenhum numero. Tente novamente." : event.message || "Falha ao usar o microfone");
    };
    recognition.onend = () => {
      if (!handledTranscriptRef.current) {
        setMicState("closed");
        setFeedback("Nao entendi o numero. Tente falar de novo.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  async function handleTranscript(value: string) {
    setMicState("processing");
    setFeedback(null);

    const command = buildVoiceCommand(value);
    if (!command) {
      setMicState("closed");
      setFeedback(
        mode === "set"
          ? "Nao entendi um numero inteiro. Exemplo: 123."
          : "Nao entendi o numero completo. Exemplo: cento e vinte e sete barra duzentos e dezessete."
      );
      return;
    }

    try {
      if (command.confirm) {
        enqueueAutomaticVoiceAdd(command, value);
        return;
      }

      const results = await api.searchCards({
        number: command.cardNumber.fullNumber,
        set: command.setId
      });
      const card = pickBestCard(results, command.cardNumber.number, command.cardNumber.printedTotal, command.setId);

      if (!card) {
        setFeedback(`Nenhuma carta encontrada para ${command.cardNumber.fullNumber}`);
        setMicState("closed");
        return;
      }

      const variant = resolveVoiceVariant(card, command.requestedVariant);
      setSelectedVariant(variant);
      setSelectedCard(card);
      setFeedback(`Encontrado: ${card.name} ${formatCardNumber(card.number, card.printedTotal)} - ${formatCardVariant(variant)}`);
      setMicState("closed");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Falha ao buscar carta por voz");
      setMicState("closed");
    }
  }

  function buildVoiceCommand(value: string): VoiceCommand | null {
    const cardNumber = buildCardNumber(value);
    if (!cardNumber) return null;

    return {
      cardNumber,
      setId: mode === "set" ? selectedSet?.id : undefined,
      requestedVariant: parseSpokenVariant(value),
      confirm: hasFinalOk(value)
    };
  }

  function buildCardNumber(value: string): { number: number; printedTotal: number; fullNumber: string } | null {
    if (mode === "set") {
      if (!selectedSet) return null;
      const number = parseSpecificSpokenNumber(value);
      return number !== null ? { number, printedTotal: selectedSet.printedTotal, fullNumber: `${number}/${selectedSet.printedTotal}` } : null;
    }

    const parsed = parseGeneralSpokenCardNumber(value);
    return parsed ? { ...parsed, fullNumber: `${parsed.number}/${parsed.printedTotal}` } : null;
  }

  async function addDetailsAndContinue(details: AddCardDetails) {
    const result = await withAuthRetry(session, onSession, onUnauthorized, (token) => api.addCollection(token, details));
    setSelectedCard(null);
    setSelectedVariant(null);
    onAdded();
    enqueueAddedPreview(result.item, result.action);
    setFeedback(
      result.action === "incremented"
        ? "Carta ja existia com estes atributos; quantidade incrementada. Microfone pronto para a proxima."
        : "Carta adicionada. Microfone pronto para a proxima."
    );
    window.setTimeout(() => startListening(), 300);
    return result;
  }

  function enqueueAutomaticVoiceAdd(command: VoiceCommand, value: string) {
    const item: VoiceQueueItem = {
      id: createLocalId("voice"),
      command,
      transcript: value,
      status: "queued"
    };
    setVoiceQueue((current) => [...current, item]);
    setMicState("closed");
    setFeedback(`${command.cardNumber.fullNumber} entrou na fila de cadastro automatico.`);
    window.setTimeout(() => startListening(), 250);
  }

  function cancelVoiceQueueItem(itemId: string) {
    canceledQueueIdsRef.current.add(itemId);
    setVoiceQueue((current) =>
      current.flatMap((item) => {
        if (item.id !== itemId) return [item];
        if (item.status === "queued" || item.status === "error") return [];
        return [{ ...item, canceled: true }];
      })
    );
  }

  async function processVoiceQueue() {
    if (processingQueueRef.current) return;
    processingQueueRef.current = true;

    try {
      while (true) {
        const item = voiceQueueRef.current.find((entry) => entry.status === "queued");
        if (!item) break;

        if (canceledQueueIdsRef.current.has(item.id)) {
          removeVoiceQueueItem(item.id);
          continue;
        }

        updateVoiceQueueItem(item.id, { status: "running" });

        try {
          const results = await api.searchCards({
            number: item.command.cardNumber.fullNumber,
            set: item.command.setId
          });
          const card = pickBestCard(results, item.command.cardNumber.number, item.command.cardNumber.printedTotal, item.command.setId);

          if (!card) {
            updateVoiceQueueItem(item.id, {
              status: "error",
              error: `Nenhuma carta encontrada para ${item.command.cardNumber.fullNumber}`
            });
            continue;
          }

          if (canceledQueueIdsRef.current.has(item.id)) {
            removeVoiceQueueItem(item.id);
            continue;
          }

          const variant = resolveVoiceVariant(card, item.command.requestedVariant);
          const result = await addVoiceCard(card, variant);
          onAdded();
          enqueueAddedPreview(result.item, result.action);
          setFeedback(
            result.action === "incremented"
              ? `${card.name} ja existia como ${formatCardVariant(variant)}; quantidade incrementada.`
              : `${card.name} cadastrada como ${formatCardVariant(variant)}.`
          );
          removeVoiceQueueItem(item.id);
        } catch (err) {
          updateVoiceQueueItem(item.id, {
            status: "error",
            error: err instanceof Error ? err.message : "Falha ao cadastrar carta"
          });
        }
      }
    } finally {
      processingQueueRef.current = false;
      if (voiceQueueRef.current.some((item) => item.status === "queued")) {
        void processVoiceQueue();
      }
    }
  }

  async function addVoiceCard(card: CardSummary, variant: string) {
    return withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.addCollection(token, {
        cardId: card.id,
        quantity: 1,
        condition: "NM",
        variant,
        foil: isFoilVariant(variant),
        language: card.language
      })
    );
  }

  function updateVoiceQueueItem(itemId: string, patch: Partial<VoiceQueueItem>) {
    const nextQueue = voiceQueueRef.current.map((item) => (item.id === itemId ? { ...item, ...patch } : item));
    voiceQueueRef.current = nextQueue;
    setVoiceQueue(nextQueue);
  }

  function removeVoiceQueueItem(itemId: string) {
    canceledQueueIdsRef.current.delete(itemId);
    const nextQueue = voiceQueueRef.current.filter((item) => item.id !== itemId);
    voiceQueueRef.current = nextQueue;
    setVoiceQueue(nextQueue);
  }

  function enqueueAddedPreview(item: CollectionItem, action: CollectionAddAction) {
    const preview = { id: createLocalId("preview"), item, action };
    const currentPreview = currentPreviewRef.current;

    if (!currentPreview) {
      showAddedPreview(preview);
      return;
    }

    previewQueueRef.current.push(preview);
    if (Date.now() - previewStartedAtRef.current >= 3000) {
      showNextAddedPreview();
    }
  }

  function showAddedPreview(preview: AddedPreview) {
    clearPreviewTimers();
    currentPreviewRef.current = preview;
    previewStartedAtRef.current = Date.now();
    setLastAddedPreview(preview);
    previewMinTimerRef.current = window.setTimeout(() => {
      if (previewQueueRef.current.length > 0) {
        showNextAddedPreview();
        return;
      }
      schedulePreviewHide();
    }, 3000);
  }

  function showNextAddedPreview() {
    const nextPreview = previewQueueRef.current.shift();
    if (nextPreview) {
      showAddedPreview(nextPreview);
      return;
    }
    schedulePreviewHide();
  }

  function schedulePreviewHide() {
    if (previewHideTimerRef.current) {
      window.clearTimeout(previewHideTimerRef.current);
    }
    previewHideTimerRef.current = window.setTimeout(() => {
      if (previewQueueRef.current.length > 0) {
        showNextAddedPreview();
        return;
      }
      currentPreviewRef.current = null;
      setLastAddedPreview(null);
    }, 7000);
  }

  function clearPreviewTimers() {
    if (previewMinTimerRef.current) {
      window.clearTimeout(previewMinTimerRef.current);
      previewMinTimerRef.current = null;
    }
    if (previewHideTimerRef.current) {
      window.clearTimeout(previewHideTimerRef.current);
      previewHideTimerRef.current = null;
    }
  }

  return (
    <Modal title="Cadastro por voz" subtitle="Escolha o modo, abra o microfone e confirme os detalhes da carta encontrada." onClose={onClose}>
      <div className="grid gap-4 p-5 md:grid-cols-[260px_1fr]">
        <div className="rounded-[22px] bg-gradient-to-br from-aqua/15 via-white to-lilac/15 p-4">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setShowHelp((current) => !current)}
              className="grid h-9 w-9 place-items-center rounded-2xl border border-line/80 bg-white/85 text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-ink"
              aria-label="Ver regras do cadastro por voz"
              title="Regras do cadastro por voz"
            >
              <CircleHelp size={17} />
            </button>
          </div>
          <MicVisualizer state={micState} />
          <div className="mt-3 grid grid-cols-2 gap-2">
            {micState === "listening" ? (
              <Button type="button" variant="ghost" icon={<MicOff size={17} />} className="col-span-2" onClick={stopListening}>
                Fechar microfone
              </Button>
            ) : (
              <Button type="button" variant="brand" icon={micState === "processing" ? <Search size={17} /> : <Radio size={17} />} className="col-span-2" disabled={!canStart} onClick={startListening}>
                {micState === "processing" ? "Buscando carta" : "Abrir microfone"}
              </Button>
            )}
          </div>
          {showHelp && <VoiceHelpCard />}
        </div>

        <div className="grid content-start gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard active={mode === "set"} icon={<Boxes size={18} />} title="Colecao especifica" onClick={() => changeMode("set")} />
            <ModeCard active={mode === "general"} icon={<Globe2 size={18} />} title="Todas as colecoes" onClick={() => changeMode("general")} />
          </div>

          {mode === "set" && (
            <label className="text-sm font-black text-slate-700">
              Colecao
              <select
                className="premium-select mt-2 w-full"
                value={selectedSetId}
                disabled={setsLoading || micState !== "closed"}
                onChange={(event) => setSelectedSetId(event.target.value)}
              >
                {setsLoading && <option>Carregando colecoes...</option>}
                {!setsLoading &&
                  sets.map((set) => (
                    <option key={set.id} value={set.id}>
                      {set.name} - {set.printedTotal}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {transcript && (
            <div className="rounded-2xl border border-aqua/30 bg-aqua/10 px-4 py-3 text-sm text-cyan-900">
              Ouvido: <span className="font-black">{transcript}</span>
            </div>
          )}

          {feedback && (
            <p className={feedback.startsWith("Encontrado") || feedback.startsWith("Carta adicionada") ? "success-note" : "warning-note"}>
              {feedback}
            </p>
          )}

          {voiceQueue.length > 0 && <VoiceQueueList items={voiceQueue} onCancel={cancelVoiceQueueItem} />}

          {!speechSupported && <p className="danger-note">Seu navegador nao disponibilizou reconhecimento de fala para esta pagina.</p>}
        </div>

        {lastAddedPreview && <LastAddedPreviewCard preview={lastAddedPreview} />}
      </div>

      <CardDetailModal card={selectedCard} initialVariant={selectedVariant} onClose={() => setSelectedCard(null)} onAdd={addDetailsAndContinue} />
    </Modal>
  );
}

function VoiceHelpCard() {
  return (
    <div className="mt-4 rounded-[20px] border border-line/80 bg-white/82 p-4 text-sm font-semibold leading-6 text-slate-600 shadow-sm">
      <p className="font-black text-ink">Comandos de voz</p>
      <p className="mt-2">Fale o numero e, se quiser, a variante depois dele.</p>
      <p>Variantes: normal, holo/foil, reverse/reverse foil/holo reverse.</p>
      <p>Diga ok no final para cadastrar direto com quantidade 1, condicao NM e idioma padrao da carta.</p>
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition duration-200 hover:-translate-y-0.5 ${
        active ? "border-brand/40 bg-brand/10 shadow-soft" : "border-line/80 bg-white/75"
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"}`}>
        {icon}
      </span>
      <span className="block text-sm font-black leading-tight text-ink">{title}</span>
    </button>
  );
}

function VoiceQueueList({ items, onCancel }: { items: VoiceQueueItem[]; onCancel: (itemId: string) => void }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-white/75 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        <Clock3 size={14} />
        Fila automatica
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-xl border border-line/70 bg-field/50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-ink">{item.command.cardNumber.fullNumber}</p>
              <p className="truncate text-xs font-semibold text-slate-500">
                {item.canceled
                  ? "Cancelando"
                  : item.status === "running"
                    ? "Cadastrando"
                    : item.status === "error"
                      ? item.error ?? "Erro"
                      : "Na fila"}
              </p>
            </div>
            {item.status === "running" && !item.canceled && <Loader2 className="animate-spin text-brand" size={16} />}
            <button
              type="button"
              onClick={() => onCancel(item.id)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-line bg-white text-slate-600 shadow-sm transition hover:border-red-200 hover:text-red-600"
              aria-label="Cancelar item da fila"
              title="Cancelar"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LastAddedPreviewCard({ preview }: { preview: AddedPreview }) {
  const { item } = preview;
  const priceText = item.price?.amount ? formatBrl(item.price.amount) : "Sem preco";

  return (
    <div className="rounded-2xl border border-leaf/25 bg-leaf/10 p-3 md:col-span-2">
      <div className="flex items-center gap-3">
        {item.card.imageSmall ? (
          <img
            src={item.card.imageSmall}
            alt={item.card.name}
            className="h-16 w-12 shrink-0 rounded-lg border border-white/80 object-cover shadow-sm"
          />
        ) : (
          <div className="grid h-16 w-12 shrink-0 place-items-center rounded-lg border border-white/80 bg-white/70 text-xs font-black text-slate-400">
            PO
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-black text-ink">{item.card.name}</p>
            <span className="rounded-full bg-white/85 px-2 py-0.5 text-xs font-black text-emerald-800">
              {preview.action === "incremented" ? "Quantidade +" : "Nova carta"}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            {formatCardNumber(item.card.number, item.card.printedTotal)} - {formatCardVariant(item.variant)} - {priceText}
          </p>
        </div>
      </div>
    </div>
  );
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pickBestCard(cards: CardSummary[], number: number, printedTotal: number, setId?: string): CardSummary | null {
  return (
    cards.find(
      (card) =>
        Number.parseInt(card.number, 10) === number &&
        card.printedTotal === printedTotal &&
        (!setId || card.setId === setId)
    ) ??
    cards.find((card) => Number.parseInt(card.number, 10) === number && card.printedTotal === printedTotal) ??
    cards[0] ??
    null
  );
}

function parseSpokenVariant(transcript: string): string | null {
  const normalized = normalizeVoiceText(transcript);
  const compact = normalized.replace(/\s+/g, "");

  if (
    normalized.includes("reverse") ||
    normalized.includes("reverso") ||
    compact.includes("reversefoil") ||
    compact.includes("reverseholo") ||
    compact.includes("holoreverse")
  ) {
    return REVERSE_HOLO_CARD_VARIANT;
  }

  if (normalized.includes("holo") || normalized.includes("foil")) {
    return HOLOFOIL_CARD_VARIANT;
  }

  if (normalized.includes("normal")) {
    return DEFAULT_CARD_VARIANT;
  }

  return null;
}

function hasFinalOk(transcript: string): boolean {
  const tokens = normalizeVoiceText(transcript).split(/\s+/).filter(Boolean);
  const last = tokens.at(-1);
  return last === "ok" || last === "okay";
}

function resolveVoiceVariant(card: CardSummary, requestedVariant: string | null): string {
  const variants = card.variants.length ? card.variants : [DEFAULT_CARD_VARIANT];
  const target = requestedVariant ?? DEFAULT_CARD_VARIANT;

  if (variants.includes(target)) return target;
  if (target === REVERSE_HOLO_CARD_VARIANT) {
    return variants.find((variant) => variant.toLowerCase().includes("reverse")) ?? fallbackVariant(variants);
  }
  if (target === HOLOFOIL_CARD_VARIANT) {
    return (
      variants.find((variant) => variant.toLowerCase().includes("holo") && !variant.toLowerCase().includes("reverse")) ??
      variants.find((variant) => variant === FOIL_CARD_VARIANT || variant.toLowerCase().includes("foil")) ??
      fallbackVariant(variants)
    );
  }

  return fallbackVariant(variants);
}

function fallbackVariant(variants: string[]): string {
  return variants.includes(DEFAULT_CARD_VARIANT) ? DEFAULT_CARD_VARIANT : variants[0] ?? DEFAULT_CARD_VARIANT;
}

function isFoilVariant(variant: string): boolean {
  return variant === FOIL_CARD_VARIANT || variant.toLowerCase().includes("holo");
}

function normalizeVoiceText(transcript: string): string {
  return transcript
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\//g, " barra ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}
