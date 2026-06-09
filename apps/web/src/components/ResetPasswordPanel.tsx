import { FormEvent, useState } from "react";
import { Lock, ArrowLeft, CheckCircle } from "lucide-react";
import { api } from "../lib/api";

type Props = {
  token: string;
  onSuccess: () => void;
  theme?: "light" | "dark";
};

export function ResetPasswordPanel({ token, onSuccess, theme = "dark" }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(onSuccess, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao definir nova senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-5 py-12">
      <form onSubmit={submit} className="glass-panel w-full max-w-[420px] p-8 shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        <h2 className="mb-2 text-2xl font-black text-white">Nova senha</h2>
        <p className="mb-8 text-sm text-slate-400">
          Defina sua nova senha de acesso abaixo.
        </p>

        {success ? (
          <div className="rounded-xl border border-leaf/20 bg-leaf/10 px-4 py-6 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle size={48} className="text-leaf" />
            </div>
            <p className="font-semibold text-leaf mb-2">Senha alterada!</p>
            <p className="text-sm text-slate-400">
              Sua senha foi atualizada com sucesso. Você será redirecionado para o login.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold text-slate-300">Nova senha</label>
              <input
                className="input-dark w-full"
                value={password}
                type="password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-sm font-bold text-slate-300">Confirmar nova senha</label>
              <input
                className="input-dark w-full"
                value={confirmPassword}
                type="password"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="••••••••"
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
                  <Lock size={20} />
                  Alterar senha
                </>
              )}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
