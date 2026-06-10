import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  BookOpenText,
  Boxes,
  CircleHelp,
  Clock3,
  Globe2,
  Keyboard,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Search,
  Sparkles,
  X
} from "lucide-react";
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
  setCode?: string | null;
  setName?: string | null;
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
  const canStart = speechSupported && micState === "closed" && (mode === "general" ? !setsLoading : Boolean(selectedSet));

  useEffect(() => {
    if (sets.length > 0 || setsLoading) return;

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
          : "Nao entendi a carta. Exemplo: 65 CRI, 65 Chaos Rising ou 65 86."
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
        set: command.setId ?? command.setCode ?? undefined
      });
      const card = pickBestCard(
        results,
        command.cardNumber.number,
        command.cardNumber.printedTotal,
        command.setId,
        command.setCode,
        command.setName
      );

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
    const spokenSet = mode === "general" ? resolveSpokenSet(value, sets) : null;
    const cardNumber = buildCardNumber(value, spokenSet);
    if (!cardNumber) return null;

    return {
      cardNumber,
      setId: mode === "set" ? selectedSet?.id : spokenSet?.id,
      setCode: mode === "general" ? spokenSet?.code : undefined,
      setName: mode === "general" ? spokenSet?.name : undefined,
      requestedVariant: parseSpokenVariant(value),
      confirm: hasFinalOk(value)
    };
  }

  function buildCardNumber(
    value: string,
    spokenSet?: CardSetSummary | null,
  ): { number: number; printedTotal: number; fullNumber: string } | null {
    if (mode === "set") {
      if (!selectedSet) return null;
      const number = parseSpecificSpokenNumber(value);
      return number !== null ? { number, printedTotal: selectedSet.printedTotal, fullNumber: `${number}/${selectedSet.printedTotal}` } : null;
    }

    const parsed = parseGeneralSpokenCardNumber(value, {
      printedTotal: spokenSet?.printedTotal
    });
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
            set: item.command.setId ?? item.command.setCode ?? undefined
          });
          const card = pickBestCard(
            results,
            item.command.cardNumber.number,
            item.command.cardNumber.printedTotal,
            item.command.setId,
            item.command.setCode,
            item.command.setName
          );

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
    <Modal title="Cadastro por voz" icon={<Mic size={20} />} onClose={onClose}>
      <div className="relative">
        <div className="grid gap-4 p-5 md:grid-cols-[260px_1fr]">
          <div className="voice-mic-panel border border-slate-300 dark:border-slate-700 rounded-[22px] dark:bg-slate-200/5 p-4">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelp((current) => !current)}
                className="grid h-9 w-9 place-items-center rounded-2xl border border-card-border/60 bg-card/85 text-muted-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-foreground"
                aria-label="Ver regras do cadastro por voz"
                title="Regras do cadastro por voz"
              >
                <CircleHelp size={17} />
              </button>
            </div>
            <MicVisualizer state={micState} />
            <div className="mt-3 grid grid-cols-2 gap-2">
            {micState === "listening" ? (
              <Button type="button" variant="ghost" icon={<MicOff size={17} />} className="col-span-2 text-white dark:text-slate-900 hover:text-white dark:hover:text-slate-200 bg-slate-400 hover:bg-slate-400/80" onClick={stopListening}>
                Fechar microfone
              </Button>
            ) : (
              <Button type="button" variant="brand" icon={micState === "processing" ? <Search size={17} /> : <Radio size={17} />} className="col-span-2" disabled={!canStart} onClick={startListening}>
                {micState === "processing" ? "Buscando carta" : "Abrir microfone"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard active={mode === "set"} icon={<Boxes size={18} />} title="Colecao especifica" onClick={() => changeMode("set")} />
            <ModeCard active={mode === "general"} icon={<Globe2 size={18} />} title="Todas as colecoes" onClick={() => changeMode("general")} />
          </div>

          {mode === "set" && (
            <label className="text-sm font-black text-foreground/80">
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
            <div className="voice-transcript rounded-2xl border border-aqua/30 bg-aqua/10 px-4 py-3 text-sm text-cyan-900">
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

          </div>

          {showHelp && (
            <>
              <div
                className="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-[3px]"
                onClick={() => setShowHelp(false)}
              />

              <VoiceHelpOverlay onClose={() => setShowHelp(false)} />
            </>
          )}
      </div>

      <CardDetailModal card={selectedCard} initialVariant={selectedVariant} onClose={() => setSelectedCard(null)} onAdd={addDetailsAndContinue} />
    </Modal>
  );
}

function VoiceHelpOverlay({ onClose }: { onClose: () => void }) {
  return (
<div className="fixed left-1/2 top-1/2 z-[70] w-[420px] max-w-[calc(100vw-40px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-card-border/60 bg-card p-4 shadow-2xl">      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-brand/10 text-brand">
            <BookOpenText size={20} />
          </div>
          <h3 className="text-lg font-black text-foreground">Comandos de voz</h3>
          <p className="text-sm font-semibold text-muted-foreground">
            Exemplos rápidos para cadastrar cartas.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-card-border/40 bg-card text-muted-foreground shadow-sm transition hover:border-brand/30 hover:text-foreground"
          aria-label="Fechar dicas"
        >
          <X size={17} />
        </button>
      </div>

      <div className="grid gap-2">
        <VoiceTip
          icon={<Boxes size={16} />}
          title="Coleção específica"
          description="Fale apenas o número."
          example={["150"]}
        />

        <VoiceTip
          icon={<Globe2 size={16} />}
          title="Todas as coleções"
          description="Fale o número completo e, se precisar, a coleção."
          example={["65 CRI", "65 Chaos Rising", "65 86"]}
        />

        <VoiceTip
          icon={<Sparkles size={16} />}
          title="Com variante"
          description="Fale a variante depois do número."
          example={["150 foil","150 reverse"]}
        />

        <VoiceTip
          icon={<BadgeCheck size={16} />}
          title="Cadastro automático"
          description='Diga "ok" no final.'
          example={["150 foil ok"]}
        />
      </div>
    </div>
  );
}

function VoiceTip({
  icon,
  title,
  description,
  example
}: {
  icon: ReactNode;
  title: string;
  description: string;
  example: string[];
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-card-border/50 bg-muted/30 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-card text-muted-foreground shadow-sm">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-black leading-tight text-foreground">{title}</p>
        <p className="text-xs font-semibold text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {
          example.map((ex, index) => (
            <span className="shrink-0 rounded-full bg-card px-3 py-1 text-xs font-black text-foreground/80 shadow-sm">
              “{ex}”
            </span>
          ))
        }
      </div>
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
        active ? "border-brand/40 bg-brand/10 shadow-soft" : "border-card-border/60 bg-card/75"
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${active ? "bg-brand text-white" : "bg-muted/40 text-muted-foreground"}`}>
        {icon}
      </span>
      <span className="block text-sm font-black leading-tight text-foreground">{title}</span>
    </button>
  );
}

function VoiceQueueList({ items, onCancel }: { items: VoiceQueueItem[]; onCancel: (itemId: string) => void }) {
  return (
    <div className="rounded-2xl border border-card-border/60 bg-card/75 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        <Clock3 size={14} />
        Fila automatica
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-xl border border-card-border/50 bg-muted/30 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-foreground">{item.command.cardNumber.fullNumber}</p>
              <p className="truncate text-xs font-semibold text-muted-foreground">
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
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-card-border/40 bg-card text-muted-foreground shadow-sm transition hover:border-red-200 hover:text-red-600"
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
            className="h-16 w-12 shrink-0 rounded-lg border border-card/80 object-cover shadow-sm"
          />
        ) : (
          <div className="grid h-16 w-12 shrink-0 place-items-center rounded-lg border border-card/80 bg-card/70 text-xs font-black text-muted-foreground/60">
            CC
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-black text-foreground">{item.card.name}</p>
            <span className="rounded-full bg-card/85 px-2 py-0.5 text-xs font-black text-emerald-800">
              {preview.action === "incremented" ? "Quantidade +" : "Nova carta"}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
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

function pickBestCard(
  cards: CardSummary[],
  number: number,
  printedTotal: number,
  setId?: string,
  setCode?: string | null,
  setName?: string | null
): CardSummary | null {
  const normalizedSetName = setName ? normalizeVoiceText(setName) : "";
  return (
    cards.find(
      (card) =>
        Number.parseInt(card.number, 10) === number &&
        card.printedTotal === printedTotal &&
        (!setId || card.setId === setId)
    ) ??
    cards.find(
      (card) =>
        Number.parseInt(card.number, 10) === number &&
        card.printedTotal === printedTotal &&
        Boolean(setCode) &&
        card.setCode?.toUpperCase() === setCode?.toUpperCase()
    ) ??
    cards.find(
      (card) =>
        Number.parseInt(card.number, 10) === number &&
        card.printedTotal === printedTotal &&
        Boolean(normalizedSetName) &&
        normalizeVoiceText(card.setName ?? "").includes(normalizedSetName)
    ) ??
    cards.find((card) => Number.parseInt(card.number, 10) === number && card.printedTotal === printedTotal) ??
    cards[0] ??
    null
  );
}

function resolveSpokenSet(transcript: string, sets: CardSetSummary[]): CardSetSummary | null {
  const normalized = ` ${normalizeVoiceText(transcript)} `;
  const candidates = sets
    .flatMap((set) =>
      setAliases(set).map((alias) => ({
        set,
        alias: normalizeVoiceText(alias)
      }))
    )
    .filter((candidate) => candidate.alias.length >= 2 && normalized.includes(` ${candidate.alias} `))
    .sort((left, right) => right.alias.length - left.alias.length);

  return candidates[0]?.set ?? null;
}

function setAliases(set: CardSetSummary): string[] {
  const base = [set.id, set.code, set.name].filter(Boolean) as string[];
  const normalizedName = normalizeVoiceText(set.name);
  return [...base, ...(SET_NAME_ALIASES[normalizedName] ?? [])];
}

const SET_NAME_ALIASES: Record<string, string[]> = {
  "ascended heroes": ["herois ascendidos", "herois ascensos"],
  "black bolt": ["raio negro"],
  "white flare": ["chama branca", "explosao branca"],
  "chaos rising": ["caos rising", "caos crescente", "caos ascendente", "ascensao do caos"],
  "prismatic evolutions": ["evolucoes prismaticas"],
  "mega evolution": ["mega evolucao"],
  "journey together": ["jornada juntos", "juntos na jornada"],
  "surging sparks": ["faiscas impulsivas", "faiscas crescentes"],
  "twilight masquerade": ["mascarada crepuscular"],
  "temporal forces": ["forcas temporais"],
  "paldean fates": ["destinos de paldea"],
  "obsidian flames": ["chamas obsidianas"],
  "paldea evolved": ["paldea evoluida"]
};

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
