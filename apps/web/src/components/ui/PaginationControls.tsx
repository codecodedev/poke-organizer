import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
};

export function PaginationControls({ page, pageSize, totalItems, onPageChange, itemLabel = "itens" }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  const btnClass = "grid h-10 w-10 place-items-center rounded-2xl border border-card-border bg-card text-muted-foreground shadow-sm transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45";

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-card-border/40 bg-card/70 px-4 py-3 shadow-sm">
      <p className="text-sm font-black text-muted-foreground">
        {start}-{end} de {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={btnClass}
          aria-label="Pagina anterior"
        >
          <ChevronLeft size={17} />
        </button>
        <span className="min-w-20 text-center text-sm font-black text-foreground">
          {currentPage}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={btnClass}
          aria-label="Proxima pagina"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
