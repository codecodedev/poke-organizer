import { FormEvent, useState } from "react";
import { LogIn, Sparkles, UserPlus } from "lucide-react";
import { api, Session } from "../lib/api";
import { saveSession } from "../lib/session";
import { Button } from "./ui/Button";

type Props = {
  onSession: (session: Session) => void;
};

export function AuthPanel({ onSession }: Props) {
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
    <section className="app-shell mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-5 py-8 lg:grid-cols-[1fr_420px]">
      <div className="max-w-2xl">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand via-coral to-amber text-lg font-black text-white shadow-glow">
          PO
        </div>
        <span className="chip mb-4">
          <Sparkles size={14} />
          Colecao premium
        </span>
        <h1 className="text-4xl font-black tracking-normal text-ink sm:text-6xl">Poke Organizer</h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
          Organize sua colecao, cadastre cartas por busca ou audio e acompanhe valores nacionais com uma interface mais leve.
        </p>
      </div>

      <form onSubmit={submit} className="glass-panel panel-padding">
        <div className="mb-5 flex rounded-2xl border border-line/80 bg-white/60 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
              mode === "login" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
            }`}
          >
            <LogIn size={16} />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition ${
              mode === "register" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
            }`}
          >
            <UserPlus size={16} />
            Criar conta
          </button>
        </div>

        {mode === "register" && (
          <label className="mb-4 block text-sm font-black text-slate-700">
            Nome
            <input
              className="premium-input mt-2 w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ash Ketchum"
            />
          </label>
        )}

        <label className="mb-4 block text-sm font-black text-slate-700">
          Email
          <input
            className="premium-input mt-2 w-full"
            value={email}
            type="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            required
          />
        </label>

        <label className="mb-4 block text-sm font-black text-slate-700">
          Senha
          <input
            className="premium-input mt-2 w-full"
            value={password}
            type="password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <p className="danger-note mb-4">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          variant="brand"
          className="w-full"
          icon={mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
        >
          {loading ? "Aguarde" : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </section>
  );
}
