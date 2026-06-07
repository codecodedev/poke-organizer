import { FormEvent, useState } from "react";
import { LogIn, Sparkles, UserPlus } from "lucide-react";
import { api, Session } from "../lib/api";
import { saveSession } from "../lib/session";
import { Button } from "./ui/Button";

type Props = {
  onSession: (session: Session) => void;
  theme?: "light" | "dark";
};

export function AuthPanel({ onSession, theme = "dark" }: Props) {
  const dark = theme === "dark";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session =
        mode === "login" ? await api.login(email, password) : await api.register(email, password, name || undefined);
      saveSession(session);
      onSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-5 py-12">
      <div className="flex flex-col items-center text-center">
        <img 
          src={dark ? "/images/logo-dark-bg.png" : "/images/logo-light-bg.png"} 
          alt="Coleciona Cards" 
          className="mb-6 h-36 w-auto animate-soft-pop scale-[2.5]"
        />
        <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-400">
              Coleção, mercado e comunidade.
        </p>
      </div>

      <form onSubmit={submit} className="glass-panel w-full max-w-[420px] p-8 shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        <div className="mb-8 flex rounded-2xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              mode === "login" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <LogIn size={18} />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              mode === "register" ? "bg-white/10 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            <UserPlus size={18} />
            Criar conta
          </button>
        </div>

        {mode === "register" && (
          <div className="mb-5">
            <label className="mb-2 block text-sm font-bold text-slate-300">Nome</label>
            <input
              className="input-dark w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Ash Ketchum"
            />
          </div>
        )}

        <div className="mb-5">
          <label className="mb-2 block text-sm font-bold text-slate-300">Email</label>
          <input
            className="input-dark w-full"
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            required
          />
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-slate-300">Senha</label>
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
              {mode === "login" ? <LogIn size={20} /> : <UserPlus size={20} />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </>
          )}
        </button>
        
        <p className="mt-6 text-center text-xs text-slate-500">
          Ao continuar, você concorda com nossos Termos de Uso.
        </p>
      </form>
    </section>
  );
}
