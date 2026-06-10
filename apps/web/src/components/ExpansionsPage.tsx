import { useEffect, useMemo, useState } from "react";
import { Search, X, Grid, List, ChevronRight, Filter } from "lucide-react";
import type { CardSetSummary } from "@poke-organizer/shared";
import { api, type Session } from "../lib/api";
import { Panel } from "./ui/Panel";
import { Button } from "./ui/Button";
import { LoadingScreen } from "./ui/LoadingScreen";

type Props = {
  session: Session | null;
  onSelectSet: (id: string) => void;
};

export function ExpansionsPage({ session, onSelectSet }: Props) {
  const [sets, setSets] = useState<CardSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [sortBy, setSortBy] = useState<"release-desc" | "release-asc" | "name-asc" | "progress-desc">("release-desc");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.listCardSetsWithProgress(session?.accessToken);
        setSets(data);
      } catch (err) {
        console.error("Failed to load sets", err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session]);

  const filteredSets = useMemo(() => {
    const filtered = sets.filter((set) => {
      const matchesQuery = set.name.toLowerCase().includes(query.toLowerCase());
      const matchesSeries = !seriesFilter || set.series === seriesFilter;
      return matchesQuery && matchesSeries;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "release-desc") return (b.releaseDate || "").localeCompare(a.releaseDate || "");
      if (sortBy === "release-asc") return (a.releaseDate || "").localeCompare(b.releaseDate || "");
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "progress-desc") return (b.userProgress?.percentage || 0) - (a.userProgress?.percentage || 0);
      return 0;
    });
  }, [sets, query, seriesFilter, sortBy]);

  const setsBySeries = useMemo(() => {
    const groups: Record<string, CardSetSummary[]> = {};
    for (const set of filteredSets) {
      const series = set.series || "Outros";
      if (!groups[series]) groups[series] = [];
      groups[series].push(set);
    }
    return groups;
  }, [filteredSets]);

  const seriesOptions = useMemo(() => {
    const uniqueSeries = Array.from(new Set(sets.map((s) => s.series).filter(Boolean))) as string[];
    return uniqueSeries.sort();
  }, [sets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-black text-foreground">Expansões</h1>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => setViewMode("grid")}
             className={`p-2 rounded-xl transition-colors ${viewMode === "grid" ? "bg-brand text-white" : "bg-card text-muted-foreground hover:bg-accent"}`}
           >
             <Grid size={20} />
           </button>
           <button 
             onClick={() => setViewMode("list")}
             className={`p-2 rounded-xl transition-colors ${viewMode === "list" ? "bg-brand text-white" : "bg-card text-muted-foreground hover:bg-accent"}`}
           >
             <List size={20} />
           </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_200px_200px]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            className="premium-input w-full pl-12 pr-11"
            placeholder="Buscar por nome da expansão..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <select 
            className="premium-select w-full pl-11"
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
          >
            <option value="">Todas as Séries</option>
            {seriesOptions.map((series) => (
              <option key={series} value={series}>{series}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select 
            className="premium-select w-full"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="release-desc">Mais recentes</option>
            <option value="release-asc">Mais antigas</option>
            <option value="name-asc">Nome (A-Z)</option>
            <option value="progress-desc">Mais completas</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingScreen message="Carregando expansões..." fullScreen={false} />
      ) : Object.keys(setsBySeries).length === 0 ? (
        <div className="py-20 text-center text-muted-foreground font-bold border-2 border-dashed border-card-border rounded-3xl">
          Nenhuma expansão encontrada.
        </div>
      ) : (
        <div className="space-y-10 pb-10">
          {Object.entries(setsBySeries).map(([series, seriesSets]) => (
            <div key={series} className="space-y-4">
              <h2 className="text-xl font-black text-foreground/80 px-2 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand"></span>
                {series}
              </h2>
              <div className={viewMode === "grid" 
                ? "grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
                : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }>
                {seriesSets.map((set) => (
                  <ExpansionCard 
                    key={set.id} 
                    set={set} 
                    viewMode={viewMode}
                    onClick={() => onSelectSet(set.id)} 
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpansionCard({ set, onClick, viewMode }: { set: CardSetSummary; onClick: () => void, viewMode: "grid" | "list" }) {
  const progress = set.userProgress || { owned: 0, total: set.printedTotal || 0, percentage: 0 };
  const initials = set.name.split(" ").map(w => w[0]).join("").slice(0, 3).toUpperCase();
  
  if (viewMode === "list") {
    return (
      <button
        onClick={onClick}
        className="group flex items-center gap-3 sm:gap-4 rounded-[20px] sm:rounded-2xl border border-card-border/40 bg-card p-3 sm:p-4 transition hover:border-brand hover:shadow-lg text-left"
      >
        <div className="h-10 w-16 sm:h-12 sm:w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 p-1 flex items-center justify-center border border-card-border/20">
          {set.logoUrl ? (
            <img src={set.logoUrl} className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110" alt="" />
          ) : (
             <div className="text-[9px] sm:text-[10px] font-black text-muted-foreground/50 tracking-widest">{initials}</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-black text-sm sm:text-base text-foreground group-hover:text-brand transition-colors">{set.name}</h3>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div 
                className="h-full bg-brand transition-all duration-500" 
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <span className="text-[9px] sm:text-[10px] font-black text-muted-foreground whitespace-nowrap shrink-0">
              {progress.owned} / {progress.total}
            </span>
          </div>
        </div>
        <ChevronRight size={18} className="text-muted-foreground/40 group-hover:text-brand shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group flex flex-col rounded-[26px] border border-card-border/40 bg-card transition hover:border-brand hover:shadow-xl text-left overflow-hidden h-full"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-muted/20 to-muted/5 p-4 flex items-center justify-center">
        {set.logoUrl ? (
          <img src={set.logoUrl} className="max-h-full max-w-full object-contain transition-transform group-hover:scale-110 drop-shadow-md" alt="" />
        ) : (
          <div className="text-3xl font-black text-muted-foreground/10 uppercase tracking-[0.2em]">{initials}</div>
        )}
        
        {set.symbolUrl && (
          <img src={set.symbolUrl} className="absolute top-3 left-3 h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" alt="" />
        )}

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
           <div className="text-[10px] font-black text-muted-foreground/60 bg-card/80 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-card-border/30">
             {progress.owned} de {progress.total}
           </div>
           <div className="relative h-4 w-4">
              <svg className="h-full w-full -rotate-90">
                <circle cx="8" cy="8" r="6" fill="transparent" stroke="currentColor" strokeWidth="2" className="text-muted/20" />
                <circle cx="8" cy="8" r="6" fill="transparent" stroke="currentColor" strokeWidth="2" strokeDasharray={2 * Math.PI * 6} strokeDashoffset={2 * Math.PI * 6 * (1 - progress.percentage / 100)} className="text-brand" />
              </svg>
           </div>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between border-t border-card-border/10">
        <h3 className="font-black text-foreground text-sm line-clamp-2 leading-tight group-hover:text-brand transition-colors">{set.name}</h3>
        <p className="mt-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{set.releaseDate?.split("/")[0] || ""}</p>
      </div>
    </button>
  );
}
