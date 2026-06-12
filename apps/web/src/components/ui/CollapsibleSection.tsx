import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  action?: ReactNode;
  disable?: boolean;
  className?: string;
};

export function CollapsibleSection({ title, children, defaultExpanded = false, action, disable, className = "" }: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`rounded-[26px] border border-line/80 bg-white/72 p-4 shadow-sm transition-all duration-200 ${className}`}>
      <div className="flex w-full items-center justify-between gap-4">
        <div className="flex flex-1 flex-row items-center justify-between gap-3 min-w-0">
          <button
            type="button"
            className="flex items-center outline-none text-left"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            <h3 className="font-black text-ink dark:text-white/70 truncate">{title}</h3>
          </button>
          {action && <div className="w-full">{action}</div>}
        </div>
        {
          (!disable || isExpanded) && (
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-black dark:text-white transition-colors"
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {isExpanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </button>
          )
        }
      </div>
      {isExpanded && (
        <>
          <div className={`mt-4 h-px w-full bg-line/80`}>
            <hr className="bg-white/90"/>
          </div>
          <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
