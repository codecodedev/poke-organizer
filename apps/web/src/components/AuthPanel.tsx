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
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
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
        if (!acceptedLegal) {
          setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar a conta.");
          return;
        }
        await api.register(email, password, name || undefined, acceptedLegal, acceptedLegal, state || undefined, city || undefined);
        setSuccessMessage("Conta criada! Verifique seu e-mail para confirmar seu cadastro antes de entrar.");
        setMode("login");
        setAcceptedLegal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col lg:flex-row items-center justify-start lg:justify-center gap-12 px-5 py-12">
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

      <form onSubmit={submit} className="glass-panel w-full max-w-[420px] p-4">
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
          <>
            <div className="mb-5">
              <label className="mb-2 block text-sm font-bold text-muted-foreground">Nome</label>
              <input
                className="input-dark w-full"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Ash Ketchum"
              />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-muted-foreground">Estado (UF)</label>
                <input
                  className="input-dark w-full"
                  value={state}
                  onChange={(event) => setState(event.target.value.toUpperCase().slice(0, 2))}
                  placeholder="Ex: SP"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-muted-foreground">Cidade</label>
                <input
                  className="input-dark w-full"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Ex: São Paulo"
                />
              </div>
            </div>
          </>
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

        {mode === "register" && (
          <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-card-border/50 bg-muted/30 p-4 text-left">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-card-border accent-cyan"
              checked={acceptedLegal}
              onChange={(event) => setAcceptedLegal(event.target.checked)}
              required
            />
            <span className="text-xs font-semibold leading-5 text-muted-foreground">
              Li e aceito os{" "}
              <a className="font-black text-brand hover:underline" href="/terms" target="_blank" rel="noreferrer">
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a className="font-black text-brand hover:underline" href="/privacy" target="_blank" rel="noreferrer">
                Política de Privacidade
              </a>
              .
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={loading || (mode === "register" && !acceptedLegal)}
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
        
        {mode === "login" && (
          <p className="mt-6 text-center text-xs font-semibold text-muted-foreground/60">
            Ao entrar, você continua sujeito aos{" "}
            <a className="text-brand hover:underline" href="/terms" target="_blank" rel="noreferrer">Termos de Uso</a>
            {" "}e à{" "}
            <a className="text-brand hover:underline" href="/privacy" target="_blank" rel="noreferrer">Política de Privacidade</a>.
          </p>
        )}
      </form>
    </section>
  );
}
