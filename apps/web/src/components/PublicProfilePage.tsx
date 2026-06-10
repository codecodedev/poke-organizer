import { useEffect, useState } from "react";
import { FolderOpen, Gavel, Mail, MapPin, Search, ShoppingBag, User } from "lucide-react";
import type { UserPublicProfile } from "@poke-organizer/shared";
import { formatCardNumber } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { formatBrl } from "../lib/format";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { SEO } from "./SEO";

type Props = {
  slug: string;
  session: Session | null;
  onSelectCollection: (shareToken: string) => void;
  onSelectAuction: (id: string) => void;
};

export function PublicProfilePage({ slug, session, onSelectCollection, onSelectAuction }: Props) {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"selling" | "viewing" | "auctions">("selling");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getUserProfile(slug);
        setProfile(data);
        if (data.collections.selling.length === 0 && data.collections.viewing.length > 0) {
          setTab("viewing");
        } else if (data.collections.selling.length === 0 && data.auctions.length > 0) {
          setTab("auctions");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Perfil não encontrado");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [slug]);

  if (loading) return <div className="p-10 text-center text-slate-500 font-bold">Carregando perfil...</div>;
  if (error || !profile) return <div className="p-10 text-center text-red-500 font-bold">{error || "Perfil não encontrado"}</div>;

  const activeCollections = tab === "selling" ? profile.collections.selling : profile.collections.viewing;

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      <SEO 
        title={`Perfil de ${profile.name}`} 
        description={profile.bio || `Confira as coleções e leilões de Pokémon TCG de ${profile.name} no Coleciona cards.`}
      />
      <aside className="space-y-6">
        <div className="overflow-hidden rounded-[32px] border border-line bg-white p-6 shadow-card dark:bg-black/20 dark:border-white/10">
          <div className="flex flex-col items-center text-center">
            <div className="grid h-24 w-24 place-items-center rounded-[32px] bg-gradient-to-br from-brand to-coral font-black text-white shadow-glow text-3xl mb-4">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <h1 className="text-2xl font-black text-ink dark:text-white">{profile.name}</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">@{profile.slug}</p>
            
            {profile.bio && (
              <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                "{profile.bio}"
              </p>
            )}
          </div>

          <div className="mt-8 space-y-4 border-t border-line/50 dark:border-white/5 pt-6">
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <ShoppingBag size={18} className="text-slate-400" />
              <span className="text-sm font-bold">{profile.collections.selling.length} Lojas</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <FolderOpen size={18} className="text-slate-400" />
              <span className="text-sm font-bold">{profile.collections.viewing.length} Pastas</span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
              <Gavel size={18} className="text-slate-400" />
              <span className="text-sm font-bold">{profile.auctions.length} Leilões</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <TabButton 
            active={tab === "selling"} 
            onClick={() => setTab("selling")}
            label="Para Venda"
            count={profile.collections.selling.length}
            icon={<ShoppingBag size={18} />}
          />
          <TabButton 
            active={tab === "viewing"} 
            onClick={() => setTab("viewing")}
            label="Vitrine"
            count={profile.collections.viewing.length}
            icon={<FolderOpen size={18} />}
          />
          <TabButton 
            active={tab === "auctions"} 
            onClick={() => setTab("auctions")}
            label="Leilões"
            count={profile.auctions.length}
            icon={<Gavel size={18} />}
          />
        </div>

        <div className="grid gap-5">
          {tab === "auctions" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {profile.auctions.length === 0 ? (
                <EmptyState message="Nenhum leilão ativo no momento." />
              ) : (
                profile.auctions.map(auction => (
                  <AuctionCard key={auction.id} auction={auction} onClick={() => onSelectAuction(auction.shareToken)} />
                ))
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {activeCollections.length === 0 ? (
                <EmptyState message="Nenhuma pasta pública nesta categoria." />
              ) : (
                activeCollections.map(folder => (
                  <CollectionFolderCard 
                    key={folder.id} 
                    folder={folder} 
                    onClick={() => folder.shareToken && onSelectCollection(folder.shareToken)} 
                  />
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, label, count, icon }: { active: boolean, onClick: () => void, label: string, count: number, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black transition-all whitespace-nowrap ${
        active 
          ? "bg-ink dark:bg-slate-300 text-white dark:text-ink shadow-lg" 
          : "bg-white text-slate-500 hover:bg-field border border-line dark:bg-black/20 dark:text-slate-400 dark:border-white/10"
      }`}
    >
      {icon}
      {label}
      <span className={`ml-1 rounded-lg px-1.5 py-0.5 text-[10px] ${active ? "bg-white/90 dark:bg-black/20 text-black dark:text-white " : "bg-slate-400 dark:bg-white/10"}`}>
        {count}
      </span>
    </button>
  );
}

function CollectionFolderCard({ folder, onClick }: { folder: any, onClick: () => void }) {
  const previewItems = (folder.previewItems || []) as any[];

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left overflow-hidden rounded-[26px] border border-line/70 bg-white transition-all hover:border-brand hover:shadow-xl dark:bg-black/20 dark:border-white/10 dark:hover:border-brand"
    >
      <div className="flex flex-1 items-center gap-4 p-5">
        {previewItems.length > 0 ? (
          <div className="grid grid-cols-2 grid-rows-2 h-16 w-14 shrink-0 gap-0.5 overflow-hidden rounded-xl border border-line/30 bg-field dark:bg-white/5">
            {previewItems.slice(0, 4).map((item: any) => (
              <div key={item.id} className="relative overflow-hidden bg-slate-100 dark:bg-white/5">
                <img src={item.card.imageSmall} className="h-full w-full object-cover" alt="" />
                <div className="absolute bottom-0.5 right-0.5 rounded-md bg-white px-1 py-0.5 text-[7px] font-black text-ink shadow-[0_2px_4px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
                  {formatCardNumber(item.card.number, item.card.printedTotal)}
                </div>
              </div>
            ))}
            {previewItems.length < 4 && 
              Array.from({ length: 4 - previewItems.length }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-slate-50 dark:bg-white/5" />
              ))
            }
          </div>
        ) : (
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-field text-slate-400 group-hover:bg-brand/10 group-hover:text-brand transition-colors dark:bg-white/5">
            <FolderOpen size={24} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black text-ink dark:text-white">{folder.name}</h3>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            {folder.itemCount} cartas • {formatBrl(folder.totalValue)}
          </p>
        </div>
      </div>
    </button>
  );
}

function AuctionCard({ auction, onClick }: { auction: any, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left overflow-hidden rounded-[26px] border border-line/70 bg-white transition-all hover:border-amber-400 hover:shadow-xl dark:bg-black/20 dark:border-white/10 dark:hover:border-amber-400"
    >
      <div className="flex flex-1 items-center gap-4 p-5">
        <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-field dark:bg-white/5">
          {auction.card.imageSmall && (
            <img src={auction.card.imageSmall} className="h-full w-full object-cover" alt="" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black text-ink dark:text-white">{auction.card.name}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
              {auction.currentBid ? formatBrl(auction.currentBid) : formatBrl(auction.minBid)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
               • {auction.bidCount} lances
            </span>
          </div>
          <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">
            Encerrando {new Date(auction.endsAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-full py-20 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-field text-slate-300 mb-4">
        <Search size={32} />
      </div>
      <p className="text-sm font-bold text-slate-400">{message}</p>
    </div>
  );
}
