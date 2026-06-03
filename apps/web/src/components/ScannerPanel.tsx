import { useRef, useState } from "react";
import { Camera, Check, ScanText, Square } from "lucide-react";
import { createWorker } from "tesseract.js";
import type { RecognitionCandidate } from "@poke-organizer/shared";
import { FOIL_CARD_VARIANT, formatCardNumber, parseOcrCardNumber, parseOcrNameHint } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onAdded: () => void;
};

export function ScannerPanel({ session, onSession, onUnauthorized, onAdded }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [candidates, setCandidates] = useState<RecognitionCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel abrir a camera");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
  }

  async function scanFrame() {
    if (!videoRef.current || !canvasRef.current) return;

    setProcessing(true);
    setError(null);
    setCandidates([]);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const worker = await createWorker("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      const text = data.text.trim();
      setOcrText(text);
      setCandidates(
        await api.recognitionCandidates({
          text,
          nameHint: parseOcrNameHint(text) ?? undefined,
          numberHint: parseOcrCardNumber(text) ?? undefined
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar OCR");
    } finally {
      setProcessing(false);
    }
  }

  async function add(candidate: RecognitionCandidate) {
    await withAuthRetry(session, onSession, onUnauthorized, (token) =>
      api.addCollection(token, {
        cardId: candidate.card.id,
        quantity: 1,
        condition: "NM",
        variant: candidate.card.variants?.[0] ?? "normal",
        foil: candidate.card.variants?.[0] === FOIL_CARD_VARIANT,
        language: candidate.card.language
      })
    );
    onAdded();
  }

  return (
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Scanner</h2>
        <div className="flex gap-2">
          {!active ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="inline-flex items-center gap-2 rounded bg-leaf px-3 py-2 text-sm font-medium text-white"
            >
              <Camera size={16} />
              Abrir camera
            </button>
          ) : (
            <button
              type="button"
              onClick={stopCamera}
              className="inline-flex items-center gap-2 rounded border border-line px-3 py-2 text-sm font-medium"
            >
              <Square size={16} />
              Parar
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded border border-line bg-ink">
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <button
        type="button"
        disabled={!active || processing}
        onClick={() => void scanFrame()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        <ScanText size={18} />
        {processing ? "Lendo carta" : "Ler nome e numero"}
      </button>

      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {ocrText && (
        <pre className="mt-3 max-h-28 overflow-auto rounded border border-line bg-field p-3 text-xs text-slate-700">
          {ocrText}
        </pre>
      )}

      {candidates.length > 0 && (
        <div className="mt-3 grid gap-2">
          {candidates.map((candidate) => (
            <article key={candidate.card.id} className="grid grid-cols-[52px_1fr_auto] gap-3 rounded border border-line p-2">
              <div className="aspect-[5/7] overflow-hidden rounded bg-field">
                {candidate.card.imageSmall && (
                  <img className="h-full w-full object-cover" src={candidate.card.imageSmall} alt={candidate.card.name} />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium text-ink">{candidate.card.name}</h3>
                <p className="text-xs text-slate-600">
                  {formatCardNumber(candidate.card.number, candidate.card.printedTotal)} - score {candidate.score}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void add(candidate)}
                className="grid h-9 w-9 place-items-center rounded border border-line text-leaf"
                aria-label="Confirmar carta"
              >
                <Check size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
