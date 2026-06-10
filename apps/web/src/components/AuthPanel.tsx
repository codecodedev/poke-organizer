import { FormEvent, useState } from "react";
import { LogIn, Sparkles, UserPlus } from "lucide-react";
import { api, Session } from "../lib/api";
import { saveSession } from "../lib/session";
import { Button } from "./ui/Button";

type Props = {
  onSession: (session: Session) => void;
  onRequestPasswordReset?: () => void;
  theme?: "light" | "dark";
};

export function AuthPanel({ onSession, onRequestPasswordReset, theme = "dark" }: Props) {
  const dark = theme === "dark";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const session = await api.login(email, password);
        saveSession(session);
        onSession(session);
      } else {
        await api.register(email, password, name || undefined);
        setSuccessMessage("Conta criada! Verifique seu e-mail para confirmar seu cadastro antes de entrar.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row items-center justify-center gap-12 px-5 py-12">
      <div className="flex flex-col items-center text-center">
        <img 
          src={dark ? "/images/logo-light-bg.png" : "/images/logo-dark-bg.png"} 
          alt="Coleciona Cards" 
          className="mb-6 h-20 sm:h-36 w-auto animate-soft-pop scale-[2.5]"
        />
        <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Coleção, mercado e comunidade.
        </p>
      </div>

      <form onSubmit={submit} className="glass-panel w-full max-w-[420px] p-4 shadow-[0_0_50px_rgba(0,242,255,0.1)]">
        <div className="mb-8 flex rounded-2xl bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              mode === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn size={18} />
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
              mode === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus size={18} />
            Criar conta
          </button>
        </div>

        {mode === "register" && (
          <div className="mb-5">
            <label className="mb-2 block text-sm font-bold text-muted-foreground">Nome</label>
            <input
              className="input-dark w-full"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Ash Ketchum"
            />
          </div>
        )}

        <div className="mb-5">
          <label className="mb-2 block text-sm font-bold text-muted-foreground">Email</label>
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
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-bold text-muted-foreground">Senha</label>
            {mode === "login" && onRequestPasswordReset && (
              <button
                type="button"
                onClick={onRequestPasswordReset}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Esqueceu a senha?
              </button>
            )}
          </div>
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
        {successMessage && <p className="mb-6 rounded-xl border border-leaf/20 bg-leaf/10 px-4 py-3 text-sm font-semibold text-leaf">{successMessage}</p>}

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
        
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Ao continuar, você concorda com nossos Termos de Uso.
        </p>
      </form>
    </section>
  );
}
