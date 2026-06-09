import { useEffect, useState, useRef } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { api } from "../lib/api";

type Props = {
  token: string;
  onComplete: () => void;
};

export function ConfirmEmailPanel({ token, onComplete }: Props) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    async function confirm() {
      try {
        await api.confirmEmail(token);
        setStatus("success");
        setTimeout(onComplete, 3000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Falha ao confirmar e-mail");
      }
    }
    confirm();
  }, [token, onComplete]);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-5 py-12">
      <div className="glass-panel w-full max-w-[420px] p-8 text-center shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        {status === "loading" && (
          <>
            <div className="flex justify-center mb-6">
              <Loader2 size={48} className="animate-spin text-brand" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">Confirmando e-mail</h2>
            <p className="text-sm text-slate-400">Aguarde um momento enquanto validamos seu cadastro...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-6">
              <CheckCircle size={48} className="text-leaf" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">E-mail confirmado!</h2>
            <p className="text-sm text-slate-400 mb-6">Sua conta foi ativada com sucesso. Redirecionando para o login...</p>
            <button
              onClick={onComplete}
              className="text-sm font-bold text-brand hover:underline"
            >
              Ir para o login agora
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-6">
              <XCircle size={48} className="text-magenta" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-white">Falha na confirmação</h2>
            <p className="text-sm text-slate-400 mb-6">{error || "O link de confirmação é inválido ou expirou."}</p>
            <button
              onClick={onComplete}
              className="btn-gradient flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm"
            >
              Voltar para o login
            </button>
          </>
        )}
      </div>
    </section>
  );
}
