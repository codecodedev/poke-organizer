import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Info, Layers3, Percent, ArrowUpDown } from "lucide-react";
import type { CardSetSummary, CardSummary } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { formatCardNumber } from "@poke-organizer/shared";

type Props = {
  setId: string;
  session: Session | null;
  onBack: () => void;
};

type CardWithProgress = CardSummary & {
  owned: boolean;
  quantity: number;
  userVariants: Array<{
    variant: string;
    quantity: number;
    foil: boolean;
    condition: string;
    language: string;
  }>;
};

export function ExpansionDetailPage({ setId, session, onBack }: Props) {
  const [data, setData] = useState<{ set: CardSetSummary; cards: CardWithProgress[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "owned" | "missing">("all");
  const [sortBy, setSortBy] = useState<"number-asc" | "number-desc" | "name-asc" | "name-desc">("number-asc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await api.getCardSetDetails(setId, session?.accessToken);
        setData(result as any);
      } catch (err) {
        console.error("Failed to load set details", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [setId, session]);

  const stats = useMemo(() => {
    if (!data) return null;
    const total = data.set.printedTotal || data.cards.length;
    const owned = data.cards.filter(c => c.owned).length;
    const missing = Math.max(0, total - owned);
    const percentage = Math.min(100, Math.round((owned / total) * 100));

    return { total, owned, missing, percentage };
  }, [data]);

  const visibleCards = useMemo(() => {
    if (!data) return [];
    
    let filtered = data.cards;
    if (activeTab === "owned") filtered = data.cards.filter(c => c.owned);
    if (activeTab === "missing") filtered = data.cards.filter(c => !c.owned);

    // Map original index to preserve original API order for 'number-asc'
    const withOriginalIndex = filtered.map((c, i) => ({ card: c, originalIndex: i }));

    return withOriginalIndex.sort((a, b) => {
      if (sortBy === "number-asc") return a.originalIndex - b.originalIndex;
      if (sortBy === "number-desc") return b.originalIndex - a.originalIndex;
      if (sortBy === "name-asc") return a.card.name.localeCompare(b.card.name);
      if (sortBy === "name-desc") return b.card.name.localeCompare(a.card.name);
      return 0;
    }).map(i => i.card);
  }, [data, activeTab, sortBy]);

  if (loading) return <div className="py-20 text-center font-bold text-muted-foreground">Carregando detalhes da expansão...</div>;
  if (!data) return <div className="py-20 text-center font-bold text-magenta">Expansão não encontrada.</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} icon={<ArrowLeft size={20} />} className="h-10 w-10 p-0 rounded-full shrink-0" />
        <div className="flex items-center gap-3 min-w-0">
          {data.set.logoUrl && (
            <div className="h-12 w-20 sm:w-24 shrink-0 overflow-hidden rounded-lg bg-muted/30 p-1 flex items-center justify-center">
              <img src={data.set.logoUrl} className="max-h-full max-w-full object-contain" alt="" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-foreground truncate">{data.set.name}</h1>
            <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest truncate">{data.set.series} • {data.set.releaseDate}</p>
          </div>
        </div>
      </header>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MiniStatCard label="Total" value={String(stats.total)} tone="lilac" icon={<Layers3 size={14} />} />
          <MiniStatCard label="Minhas" value={String(stats.owned)} tone="leaf" icon={<CheckCircle2 size={14} />} />
          <MiniStatCard label="Faltando" value={String(stats.missing)} tone="aqua" icon={<Circle size={14} />} />
          <MiniStatCard label="Progresso" value={`${stats.percentage}%`} tone="brand" icon={<Percent size={14} />} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between border-b border-card-border pb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <TabButton active={activeTab === "all"} onClick={() => setActiveTab("all")} label="Todas" count={data.cards.length} />
          <TabButton active={activeTab === "owned"} onClick={() => setActiveTab("owned")} label="Minhas" count={data.cards.filter(c => c.owned).length} />
          <TabButton active={activeTab === "missing"} onClick={() => setActiveTab("missing")} label="Faltando" count={data.cards.filter(c => !c.owned).length} />
        </div>
        
        <div className="relative shrink-0 w-full sm:w-48">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <select 
            className="premium-select w-full pl-9 py-2 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="number-asc">Número (Crescente)</option>
            <option value="number-desc">Número (Decrescente)</option>
            <option value="name-asc">Nome (A-Z)</option>
            <option value="name-desc">Nome (Z-A)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 pb-10">
        {visibleCards.map((card) => (
          <ExpansionCardItem key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean, onClick: () => void, label: string, count: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-2xl text-sm font-black transition-all whitespace-nowrap ${
        active 
          ? "bg-brand text-white shadow-glow" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {label}
      <span className={`ml-2 opacity-60 text-xs`}>{count}</span>
    </button>
  );
}

function ExpansionCardItem({ card }: { card: CardWithProgress }) {
  return (
    <div className={`group relative flex flex-col rounded-3xl border transition-all ${
      card.owned 
        ? "border-leaf/30 bg-leaf/5 shadow-sm" 
        : "border-card-border/40 bg-card/40 grayscale opacity-60 grayscale-[0.8]"
    }`}>
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-[22px] p-2">
        <img 
          src={card.imageSmall || ""} 
          alt={card.name} 
          className="h-full w-full object-contain transition-transform group-hover:scale-110" 
          loading="lazy"
        />
        {card.owned && (
          <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-leaf text-white grid place-items-center shadow-md">
            <CheckCircle2 size={14} />
          </div>
        )}
      </div>
      <div className="p-3">
        <h4 className="font-black text-foreground text-xs truncate" title={card.name}>{card.name}</h4>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] font-black text-muted-foreground">{formatCardNumber(card.number, card.printedTotal)}</span>
          {card.quantity > 0 && (
            <span className="text-[10px] font-black text-leaf">x{card.quantity}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStatCard({ label, value, tone, icon }: { label: string, value: string, tone: "aqua" | "brand" | "leaf" | "lilac", icon: React.ReactNode }) {
  const tones = {
    aqua: "from-cyan/20 to-cyan/5",
    brand: "from-magenta/20 to-magenta/5",
    leaf: "from-emerald-500/20 to-emerald-500/5",
    lilac: "from-cyan/20 to-magenta/20"
  };

  return (
    <div className={`rounded-[20px] border border-card-border/40 bg-gradient-to-br ${tones[tone]} p-3 sm:p-4 shadow-sm backdrop-blur-xl`}>
       <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 mb-1 sm:mb-2">
         {icon}
         <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest truncate">{label}</span>
       </div>
       <p className="text-xl sm:text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}
