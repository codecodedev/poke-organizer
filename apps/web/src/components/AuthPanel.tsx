import { FormEvent, useEffect, useRef, useState } from "react";
import { LogIn, UserPlus, Mail } from "lucide-react";
import { api, Session } from "../lib/api";
import { saveSession } from "../lib/session";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

type Props = {
  onSession: (session: Session) => void;
  onRequestPasswordReset?: () => void;
  theme?: "light" | "dark";
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { 
              theme?: "outline" | "filled_blue" | "filled_black"; 
              size?: "large" | "medium" | "small"; 
              width?: number; 
              text?: string;
              shape?: "rectangular" | "pill";
              logo_alignment?: "left" | "center";
            },
          ) => void;
        };
      };
    };
  }
}

export function AuthPanel({ onSession, onRequestPasswordReset, theme = "dark" }: Props) {
  const dark = theme === "dark";
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
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
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    let cancelled = false;
    const initializeGoogle = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            setError("Não foi possível autenticar com Google.");
            return;
          }
          setError(null);
          setSuccessMessage(null);
          setLoading(true);
          try {
            const session = await api.googleLogin(response.credential);
            saveSession(session);
            onSession(session);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Falha ao autenticar com Google");
          } finally {
            setLoading(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: dark ? "filled_black" : "outline",
        size: "large",
        width: googleButtonRef.current.parentElement?.offsetWidth || 380,
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
      });
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[src='https://accounts.google.com/gsi/client']");
    if (existingScript) {
      existingScript.addEventListener("load", initializeGoogle, { once: true });
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", initializeGoogle);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.onload = null;
    };
  }, [dark, googleClientId, onSession]);

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
        if (!name.trim() || name.trim().length < 3) {
          setError("O nome é obrigatório e deve ter pelo menos 3 caracteres.");
          setLoading(false);
          return;
        }
        if (!state) {
          setError("O estado (UF) é obrigatório.");
          setLoading(false);
          return;
        }
        if (!city.trim()) {
          setError("A cidade é obrigatória.");
          setLoading(false);
          return;
        }
        if (!acceptedLegal) {
          setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade para criar a conta.");
          setLoading(false);
          return;
        }
        const res = await api.register(email, password, name.trim(), acceptedLegal, acceptedLegal, state, city.trim());
        setSuccessMessage(res.message || "Conta criada! Verifique seu e-mail para confirmar seu cadastro antes de entrar.");
        setMode("login");
        setAcceptedLegal(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email) {
      setError("Informe seu e-mail para reenviar a confirmação.");
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const res = await api.requestEmailConfirmation(email);
      setSuccessMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reenviar e-mail");
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
              <label className="mb-2 block text-sm font-bold text-muted-foreground">Nome completo</label>
              <input
                className="input-dark w-full"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: Ash Ketchum"
                required
              />
            </div>

            <div className="mb-5 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-muted-foreground">Estado (UF)</label>
                <select
                  className="input-dark w-full h-11"
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {BRAZILIAN_STATES.map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-muted-foreground">Cidade</label>
                <input
                  className="input-dark w-full"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Ex: São Paulo"
                  required
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

        {error && (
          <div className="mb-6 rounded-xl border border-magenta/20 bg-magenta/10 px-4 py-3 text-sm font-semibold text-magenta flex flex-col gap-2">
            <p>{error}</p>
            {(error.includes("confirme seu e-mail") || error.includes("Aguarde") || error.includes(" reenviar")) && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-magenta/70 hover:text-magenta transition self-start"
              >
                <Mail size={12} />
                Tentar reenviar e-mail agora
              </button>
            )}
          </div>
        )}
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

        {googleClientId && (
          <div className="mt-8">
            <div className="mb-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-card-border/40" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">ou entre com sua conta</span>
              <span className="h-px flex-1 bg-card-border/40" />
            </div>
            <div className="flex justify-center w-full min-h-[44px]" ref={googleButtonRef} />
          </div>
        )}
        
        {mode === "login" && (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-center text-xs font-semibold text-muted-foreground/60">
              Ao entrar, você continua sujeito aos{" "}
              <a className="text-brand hover:underline" href="/terms" target="_blank" rel="noreferrer">Termos de Uso</a>
              {" "}e à{" "}
              <a className="text-brand hover:underline" href="/privacy" target="_blank" rel="noreferrer">Política de Privacidade</a>.
            </p>
          </div>
        )}
      </form>
    </section>
  );
}
