import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  ExternalLink, 
  Gavel, 
  Globe, 
  ShoppingBag, 
  User as UserIcon,
  Check,
  Copy,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { api, apiFeedback, type Session } from "../lib/api";
import { withAuthRetry } from "../lib/authRetry";
import { Button } from "./ui/Button";
import { Panel } from "./ui/Panel";
import { formatBrl } from "../lib/format";
import type { CollectionCartOffer } from "@poke-organizer/shared";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onBack: () => void;
  initialTab?: string | null;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  blockedNavigationAt?: number;
};

export function ProfilePage({ session, onSession, onUnauthorized, onBack, initialTab, onUnsavedChanges, blockedNavigationAt }: Props) {
  const [tab, setTab] = useState<"proposals" | "settings">(initialTab === "settings" ? "settings" : "proposals");
  
  const [shouldShake, setShouldShake] = useState(false);

  useEffect(() => {
    if (blockedNavigationAt && blockedNavigationAt > 0) {
      setShouldShake(true);
      const timer = setTimeout(() => setShouldShake(false), 800);
      return () => clearTimeout(timer);
    }
  }, [blockedNavigationAt]);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab === "settings" ? "settings" : "proposals");
    }
  }, [initialTab]);

  const [proposals, setProposals] = useState<CollectionCartOffer[]>([]);
  const [receivedProposals, setReceivedProposals] = useState<CollectionCartOffer[]>([]);
  const [proposalsSubTab, setProposalsSubTab] = useState<"sent" | "received">("sent");
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState(session.user.name || "");
  const [whatsapp, setWhatsapp] = useState(session.user.whatsapp || "");
  const [profileSlug, setProfileSlug] = useState(session.user.profileSlug || "");
  const [profileBio, setProfileBio] = useState(session.user.profileBio || "");
  const [isPublicProfile, setIsPublicProfile] = useState(session.user.isPublicProfile || false);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const changed = 
      name !== (session.user.name || "") ||
      whatsapp !== (session.user.whatsapp || "") ||
      profileSlug !== (session.user.profileSlug || "") ||
      profileBio !== (session.user.profileBio || "") ||
      isPublicProfile !== (session.user.isPublicProfile || false);
    
    onUnsavedChanges?.(changed);
  }, [name, whatsapp, profileSlug, profileBio, isPublicProfile, session.user, onUnsavedChanges]);

  useEffect(() => {
    if (!profileSlug || profileSlug === session.user.profileSlug) {
      setSlugStatus("idle");
      return;
    }

    if (profileSlug.length < 3) {
      setSlugStatus("invalid");
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus("checking");
      try {
        const { available } = await api.checkProfileSlug(profileSlug);
        setSlugStatus(available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [profileSlug, session.user.profileSlug]);

  async function loadProposals() {
    setLoading(true);
    try {
      const [sent, received] = await withAuthRetry(session, onSession, onUnauthorized, async (token) => {
        return Promise.all([
          api.listMyProposals(token),
          api.listReceivedProposals(token)
        ]);
      });
      setProposals(sent);
      setReceivedProposals(received);
    } catch (err) {
      console.error("Failed to load profile data", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProposals();
  }, [session, onSession, onUnauthorized]);

  async function handleDecideOffer(offer: CollectionCartOffer, status: "accepted" | "rejected") {
    try {
      await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.decideCollectionOffer(token, offer.folderId, offer.id, status)
      );
      apiFeedback.success(status === "accepted" ? "Proposta aceita!" : "Proposta recusada.");
      void loadProposals();
    } catch (err) {
      apiFeedback.error(err instanceof Error ? err.message : "Erro ao decidir proposta");
    }
  }

  async function handleUpdateProfile() {
    setMessage(null);
    setUpdating(true);
    try {
      const updatedUser = await withAuthRetry(session, onSession, onUnauthorized, (token) =>
        api.updateUserProfile(token, {
          name,
          whatsapp,
          profileSlug,
          profileBio,
          isPublicProfile
        })
      );
      
      // Update session with new user data
      onSession({
        ...session,
        user: {
          ...session.user,
          ...updatedUser
        }
      });

      setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
      apiFeedback.success("Perfil atualizado com sucesso!");
      
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get("returnTo");
      if (returnTo) {
        setTimeout(() => {
          window.location.href = returnTo;
        }, 1200);
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao atualizar perfil" });
    } finally {
      setUpdating(false);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/public/profile/${profileSlug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-card-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground shadow-sm"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-foreground">
              {tab === "proposals" ? "Propostas de Negociação" : "Configurações de Perfil"}
            </h1>
            <p className="text-sm font-semibold text-muted-foreground">
              {tab === "proposals" 
                ? "Gerencie as propostas enviadas e recebidas em coleções." 
                : "Gerencie suas informações e visibilidade do seu perfil público."}
            </p>
          </div>
        </div>
      </div>

      <Panel className="p-0 overflow-hidden border-card-border/40">
        {loading ? (
          <div className="py-24 text-center font-black text-muted-foreground animate-pulse">Carregando dados...</div>
        ) : (
          <div className="divide-y divide-card-border/20">
            {tab === "proposals" ? (
              <>
                <div className="bg-muted/10 p-4 border-b border-card-border/20">
                    <div className="flex gap-2 rounded-2xl bg-muted/30 p-1 w-fit">
                        <button
                            className={`rounded-xl px-6 py-2 text-xs font-black transition ${proposalsSubTab === "sent" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setProposalsSubTab("sent")}
                        >
                            Propostas que eu fiz
                        </button>
                        <button
                            className={`rounded-xl px-6 py-2 text-xs font-black transition ${proposalsSubTab === "received" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            onClick={() => setProposalsSubTab("received")}
                        >
                            Propostas que recebi
                        </button>
                    </div>
                </div>

                {(proposalsSubTab === "sent" ? proposals : receivedProposals).length === 0 ? (
                  <div className="py-24 text-center">
                    <p className="text-sm font-bold text-muted-foreground">
                        {proposalsSubTab === "sent" 
                            ? "Você ainda não fez nenhuma proposta em coleções." 
                            : "Você ainda não recebeu nenhuma proposta em suas coleções."}
                    </p>
                  </div>
                ) : (
                  (proposalsSubTab === "sent" ? proposals : receivedProposals).map((offer) => (
                    <div key={offer.id} className="p-4 sm:p-6 transition hover:bg-accent/30">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Proposta</span>
                            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                              offer.status === "accepted" ? "bg-leaf text-white" :
                              offer.status === "rejected" ? "bg-magenta text-white" :
                              "bg-amber/20 text-amber"
                            }`}>
                              {offer.status === "accepted" ? "Aceita" : offer.status === "rejected" ? "Recusada" : "Pendente"}
                            </span>
                            {offer.isGlobalOffer && (
                                <span className="rounded-lg bg-brand px-2 py-1 text-[10px] font-black text-white uppercase tracking-tighter">
                                    Global
                                </span>
                            )}
                          </div>
                          
                          <div className="mt-2">
                             {proposalsSubTab === "received" && (
                                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">De: {offer.buyerName}</p>
                             )}
                             <h3 className="text-xl sm:text-2xl font-black text-foreground">Valor sugerido: {formatBrl(offer.totalOffer)}</h3>
                             <p className="mt-1 text-sm font-semibold text-muted-foreground">
                                {proposalsSubTab === "sent" ? "Enviada" : "Recebida"} em: {new Date(offer.createdAt).toLocaleDateString()}
                             </p>
                          </div>
                          
                          <div className="mt-4 flex flex-wrap gap-2">
                            {offer.items.map((item) => (
                              <div key={item.id} className="rounded-xl bg-card px-3 py-1.5 text-[10px] sm:text-xs font-bold text-muted-foreground border border-card-border/40 shadow-sm">
                                {item.quantity}x {item.item.card.name}
                              </div>
                            ))}
                          </div>

                          {offer.message && (
                            <div className="mt-4 rounded-2xl bg-muted/20 p-4 border border-card-border/30">
                                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-1">Mensagem</p>
                                <p className="text-sm italic text-foreground">"{offer.message}"</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                            {proposalsSubTab === "received" && offer.status === "pending" && (
                                <div className="flex gap-2 w-full">
                                    <Button
                                        variant="brand"
                                        className="h-11 flex-1 md:px-6 bg-leaf hover:bg-emerald-600 text-white border-none shadow-sm"
                                        onClick={() => handleDecideOffer(offer, "accepted")}
                                    >
                                        Aceitar
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-11 flex-1 md:px-6 text-magenta border-magenta/20 hover:bg-magenta/5"
                                        onClick={() => handleDecideOffer(offer, "rejected")}
                                    >
                                        Recusar
                                    </Button>
                                </div>
                            )}
                            <Button
                                variant={proposalsSubTab === "sent" ? "brand" : "outline"}
                                className="h-11 px-6 text-sm w-full md:w-auto"
                                icon={<ExternalLink size={16} />}
                                onClick={() => window.location.href = `/?publicCollection=${offer.folderId}`}
                            >
                                {proposalsSubTab === "sent" ? "Ver Coleção" : "Ir para Coleção"}
                            </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="p-8 space-y-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">E-mail</label>
                    <input
                      className="premium-input w-full opacity-60 cursor-not-allowed"
                      value={session.user.email}
                      disabled
                      title="O e-mail não pode ser alterado"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nome de Exibição</label>
                    <input
                      className="premium-input w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome ou apelido"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">WhatsApp</label>
                    <input
                      className="premium-input w-full"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="Ex: 11999999999"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Link do Perfil (Slug)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">@</span>
                      <input
                        className={`premium-input w-full pl-10 pr-10 ${
                          slugStatus === "available" ? "border-leaf/50 focus:border-leaf" :
                          slugStatus === "taken" || slugStatus === "invalid" ? "border-magenta/50 focus:border-magenta" : ""
                        }`}
                        value={profileSlug}
                        onChange={(e) => setProfileSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="seu-apelido"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        {slugStatus === "checking" && <Loader2 size={18} className="animate-spin text-muted-foreground" />}
                        {slugStatus === "available" && <Check size={18} className="text-leaf" />}
                        {(slugStatus === "taken" || slugStatus === "invalid") && <AlertCircle size={18} className="text-magenta" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <p className={`text-[10px] font-bold ${
                        slugStatus === "taken" ? "text-magenta" :
                        slugStatus === "available" ? "text-leaf" :
                        slugStatus === "invalid" ? "text-magenta" : "text-muted-foreground"
                      }`}>
                        {slugStatus === "taken" ? "Este link já está em uso" :
                         slugStatus === "available" ? "Link disponível!" :
                         slugStatus === "invalid" ? "Mínimo 3 caracteres" :
                         "coleciona.cards/public/profile/" + (profileSlug || "seu-apelido")}
                      </p>
                      
                      {profileSlug && !["taken", "invalid"].includes(slugStatus) && (
                        <button 
                          onClick={handleCopyLink}
                          className="flex items-center gap-1 text-[10px] font-black text-brand uppercase hover:underline"
                        >
                          {copied ? <Check size={10} /> : <Copy size={10} />}
                          {copied ? "Copiado!" : "Copiar Link"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Biografia</label>
                  <textarea
                    className="premium-input w-full min-h-[120px] py-4"
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    placeholder="Conte um pouco sobre você e sua coleção..."
                  />
                </div>

                <div className="flex items-center justify-between rounded-[24px] border border-card-border/40 bg-muted/20 p-6">
                  <div className="flex items-center gap-4">
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl ${isPublicProfile ? "bg-leaf text-white" : "bg-muted text-muted-foreground"}`}>
                      <Globe size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-foreground">Perfil Público</h4>
                      <p className="text-xs font-semibold text-muted-foreground">Permitir que qualquer pessoa veja seu perfil e coleções públicas.</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublicProfile}
                    onChange={(e) => setIsPublicProfile(e.target.checked)}
                    className="h-7 w-7 rounded-lg border-card-border text-brand focus:ring-brand/30"
                  />
                </div>

                {message && (
                  <div className={`rounded-2xl p-4 text-sm font-bold animate-in fade-in slide-in-from-top-2 ${
                    message.type === "success" ? "bg-leaf/10 text-leaf" : "bg-magenta/10 text-magenta"
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="flex justify-end border-t border-card-border/30 pt-8">
                  <Button
                    variant="brand"
                    className="h-12 px-10 shadow-glow"
                    disabled={updating || slugStatus === "taken" || slugStatus === "checking" || slugStatus === "invalid"}
                    onClick={handleUpdateProfile}
                    shake={shouldShake}
                  >
                    {updating ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
