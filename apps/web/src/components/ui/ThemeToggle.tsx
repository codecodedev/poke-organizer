import { Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark";

export function ThemeToggle({
  theme,
  onToggle,
  className = "",
}: {
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
}) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`btn border border-line bg-white/80 text-night shadow-sm hover:border-lilac/40 ${className}`}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
      title={dark ? "Modo claro" : "Modo escuro"}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      <span>{dark ? "Claro" : "Escuro"}</span>
    </button>
  );
}
