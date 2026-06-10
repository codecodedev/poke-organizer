import { FormEvent, useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "./ui/Button";

type Props = {
  onBack: () => void;
  theme?: "light" | "dark";
};

export function RequestPasswordResetPanel({ onBack, theme = "dark" }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.requestPasswordReset(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao solicitar recuperação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-5 py-12">
      <form onSubmit={submit} className="glass-panel w-full max-w-[420px] p-8 shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-muted-foreground/60 hover:text-foreground transition"
        >
          <ArrowLeft size={16} />
          Voltar para o login
        </button>

        <h2 className="mb-2 text-2xl font-black text-foreground">Recuperar senha</h2>
        <p className="mb-8 text-sm text-muted-foreground/60">
          Informe seu e-mail e enviaremos um link para você definir uma nova senha.
        </p>

        {success ? (
          <div className="rounded-xl border border-leaf/20 bg-leaf/10 px-4 py-6 text-center">
            <p className="font-semibold text-leaf mb-4">E-mail enviado!</p>
            <p className="text-sm text-muted-foreground/60">
              Se houver uma conta associada a este e-mail, você receberá as instruções em instantes.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="mb-2 block text-sm font-bold text-foreground/80">Email</label>
              <input
                className="input-dark w-full"
                value={email}
                type="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@email.com"
                required
              />
            </div>

            {error && <p className="mb-6 rounded-xl border border-magenta/20 bg-magenta/10 px-4 py-3 text-sm font-semibold text-magenta">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-gradient flex h-14 w-full items-center justify-center gap-3 rounded-2xl text-lg disabled:opacity-50"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Mail size={20} />
                  Enviar link
                </>
              )}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
