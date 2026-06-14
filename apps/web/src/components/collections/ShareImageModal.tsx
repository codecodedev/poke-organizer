import { useState, useMemo, useRef, useEffect } from "react";
import { Download, Share2, X, Check, Eye, Loader2, MessageCircle, Info, ChevronRight, ChevronLeft } from "lucide-react";
import { toJpeg } from "html-to-image";
import { 
  formatCardNumber, 
  type CollectionItem, 
  type CollectionFolderSort
} from "@poke-organizer/shared";
import { formatBrl } from "../../lib/format";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  items: CollectionItem[];
};

type ShareOptions = {
  cardsPerImage: number;
  showNumber: boolean;
  showCondition: boolean;
  showLanguage: boolean;
  showPrice: boolean;
  sort: CollectionFolderSort;
};

export function ShareImageModal({ isOpen, onClose, folderName, items }: Props) {
  const [shareName, setShareName] = useState(folderName);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [options, setOptions] = useState<ShareOptions>({
    cardsPerImage: 8,
    showNumber: true,
    showCondition: true,
    showLanguage: true,
    showPrice: true,
    sort: "value-desc",
  });

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Sincronizar shareName quando folderName mudar
  useEffect(() => {
    setShareName(folderName);
  }, [folderName]);

  // Resetar previewIndex quando as opções mudarem (pois o número de chunks muda)
  useEffect(() => {
    setPreviewIndex(0);
  }, [options.cardsPerImage, options.sort]);

  // Medir altura do conteúdo para escala perfeita
  useEffect(() => {
    if (contentRef.current && isOpen) {
      // Pequeno delay para garantir que o layout interno estabilizou
      const timer = setTimeout(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.offsetHeight);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [previewIndex, options.cardsPerImage, isOpen]);

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    switch (options.sort) {
      case "value-desc":
        sorted.sort((a, b) => (getItemPrice(b) || 0) - (getItemPrice(a) || 0));
        break;
      case "value-asc":
        sorted.sort((a, b) => (getItemPrice(a) || 0) - (getItemPrice(b) || 0));
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "oldest":
        sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
    }
    return sorted;
  }, [items, options.sort]);

  const chunks = useMemo(() => {
    const result = [];
    for (let i = 0; i < sortedItems.length; i += options.cardsPerImage) {
      result.push(sortedItems.slice(i, i + options.cardsPerImage));
    }
    return result;
  }, [sortedItems, options.cardsPerImage]);

  async function downloadAll() {
    setGenerating(true);
    setProgress({ current: 0, total: chunks.length });
    
    try {
      for (let i = 0; i < chunks.length; i++) {
        setProgress(prev => ({ ...prev, current: i + 1 }));
        const dataUrl = await captureChunk(i);
        if (!dataUrl) continue;

        const link = document.createElement("a");
        const suffix = chunks.length > 1 ? ` - ${i + 1}_${chunks.length}` : "";
        link.download = `${shareName.replace(/\//g, "-")}${suffix}.jpg`;
        link.href = dataUrl;
        link.click();
        
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (error) {
      console.error("Error downloading images:", error);
      alert("Erro ao gerar imagens. Tente novamente.");
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  }

  async function imageUrlToDataUrl(url: string, format = "image/png"): Promise<string> {
    if (!url) return "";
    
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      const timeout = setTimeout(() => {
        resolve(url);
      }, 10000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(url);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL(format));
        } catch (e) {
          resolve(url);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        resolve(url);
      };

      const cacheBuster = url.includes("?") ? `&v=${Date.now()}` : `?v=${Date.now()}`;
      img.src = url + cacheBuster;
    });
  }

  async function captureChunk(index: number): Promise<string | null> {
    const chunk = chunks[index];
    if (!chunk) return null;

    const chunkWithDataUrls = [];
    for (const item of chunk) {
      const dataUrl = await imageUrlToDataUrl(item.card.imageSmall || "", "image/jpeg");
      chunkWithDataUrls.push({ ...item, dataUrl });
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const logoDataUrl = await imageUrlToDataUrl(`${window.location.origin}/images/logo-preview.png`, "image/png");

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "-100";
    container.style.width = "1200px";
    container.style.backgroundColor = "#111827";
    container.style.padding = "30px"; // Menor padding para as cartas crescerem
    container.style.display = "flex";
    container.style.flexDirection = "column";
    document.body.appendChild(container);

    const cardsPerRow = options.cardsPerImage > 4 ? 4 : 2;
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(${cardsPerRow}, 1fr); gap: 24px; width: 100%;">
        ${chunkWithDataUrls.map(item => renderCardHtml(item, options, item.dataUrl)).join("")}
      </div>
      <div style="margin-top: 40px; display: flex; align-items: center; justify-content: space-between; width: 100%; border-top: 1px solid #1f2937; padding-top: 20px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <img src="${logoDataUrl}" style="height: 32px;" />
          <span style="color: white; font-weight: 800; font-size: 20px; font-family: sans-serif; letter-spacing: -0.025em;">${shareName}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span style="color: #6b7280; font-size: 16px; font-family: sans-serif; font-weight: 600;">coleciona.cards</span>
          ${chunks.length > 1 ? `<span style="background: #1f2937; color: #9ca3af; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-family: sans-serif; font-weight: 700;">${index + 1} / ${chunks.length}</span>` : ""}
        </div>
      </div>
    `;

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const rect = container.getBoundingClientRect();
      const actualHeight = Math.ceil(rect.height);

      const dataUrl = await toJpeg(container, { 
        quality: 0.95, 
        width: 1200,
        height: actualHeight,
        backgroundColor: "#111827",
        style: {
          visibility: "visible",
        }
      });
      return dataUrl;
    } catch (e) {
      console.error("Capture error:", e);
      return null;
    } finally {
      document.body.removeChild(container);
    }
  }

  if (!isOpen) return null;

  const previewScale = typeof window !== "undefined" ? Math.min(1, (window.innerWidth < 800 ? window.innerWidth - 64 : 800) / 1200) : 1;

  const modalFooter = (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        variant="brand"
        className="flex-1 py-3.5 sm:py-4 text-sm sm:text-base font-black uppercase tracking-widest shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all"
        icon={generating ? null : <Download size={20} />}
        disabled={generating || items.length === 0}
        onClick={downloadAll}
      >
        {generating ? "Processando..." : "Baixar Todas as Imagens"}
      </Button>
      
      <Button
        variant="ghost"
        className="py-3.5 sm:py-4 px-8 text-sm sm:text-base font-bold text-text-tertiary hover:text-text-primary transition-colors"
        onClick={onClose}
      >
        Cancelar
      </Button>
    </div>
  );

  return (
    <Modal
      title="Gerar Imagens para Compartilhamento"
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      footer={modalFooter}
    >
      <div className="p-4 sm:p-6 space-y-8">
        {/* Opções */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-card-bg/30 p-5 rounded-3xl border border-card-border/40 shadow-inner">
          <div className="md:col-span-2 space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Nome da Coleção na Imagem</label>
            <input 
              type="text"
              className="w-full bg-input-bg border border-input-border rounded-xl px-5 py-3.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-bold placeholder:text-text-tertiary/50"
              placeholder="Ex: Minhas Cartas Raras"
              value={shareName}
              onChange={e => setShareName(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Cartas por imagem</label>
            <select 
              className="w-full bg-input-bg border border-input-border rounded-xl px-5 py-3.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-bold appearance-none cursor-pointer hover:border-brand/40"
              value={options.cardsPerImage}
              onChange={e => setOptions({ ...options, cardsPerImage: Number(e.target.value) })}
            >
              <option value={4}>4 cartas (2x2)</option>
              <option value={8}>8 cartas (4x2)</option>
              <option value={12}>12 cartas (4x3)</option>
              <option value={16}>16 cartas (4x4)</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Ordenação</label>
            <select 
              className="w-full bg-input-bg border border-input-border rounded-xl px-5 py-3.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/50 transition-all font-bold appearance-none cursor-pointer hover:border-brand/40"
              value={options.sort}
              onChange={e => setOptions({ ...options, sort: e.target.value as CollectionFolderSort })}
            >
              <option value="value-desc">Maior Valor</option>
              <option value="value-asc">Menor Valor</option>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-text-tertiary ml-1">Informações na Badge</label>
            <div className="flex flex-wrap gap-3">
              <OptionToggle 
                label="Número" 
                active={options.showNumber} 
                onClick={() => setOptions({ ...options, showNumber: !options.showNumber })} 
              />
              <OptionToggle 
                label="Condição" 
                active={options.showCondition} 
                onClick={() => setOptions({ ...options, showCondition: !options.showCondition })} 
              />
              <OptionToggle 
                label="Idioma" 
                active={options.showLanguage} 
                onClick={() => setOptions({ ...options, showLanguage: !options.showLanguage })} 
              />
              <OptionToggle 
                label="Valor" 
                active={options.showPrice} 
                onClick={() => setOptions({ ...options, showPrice: !options.showPrice })} 
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary flex items-center gap-3">
              <Eye size={16} className="text-brand" />
              Preview Real da Imagem
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-tertiary bg-card-bg/50 px-3 py-1.5 rounded-full border border-card-border/40 shadow-sm">
                {chunks.length} imagem(ns)
              </span>
            </div>
          </div>
          
          <div 
            className="group relative w-full overflow-hidden rounded-[24px] border border-card-border/60 shadow-2xl bg-[#0b0f1a]"
            style={{ 
              height: contentHeight > 0 ? `${contentHeight * previewScale}px` : "200px",
              transition: "height 0.3s ease-out"
            }}
          >
            <div className="w-full flex justify-center bg-[#111827]">
              <div 
                ref={contentRef}
                className="origin-top shrink-0 py-8 px-8"
                style={{ 
                  width: "1200px",
                  transform: `scale(${previewScale})`,
                }}
              >
                <div className={`grid gap-6 w-full ${options.cardsPerImage > 4 ? "grid-cols-4" : "grid-cols-2"}`}>
                  {chunks[previewIndex]?.map(item => (
                    <PreviewCard key={item.id} item={item} options={options} />
                  ))}
                </div>
                
                <div className="mt-10 w-full flex items-center justify-between border-t border-gray-800/80 pt-5">
                  <div className="flex items-center gap-3">
                    <img src="/images/logo-preview.png" className="h-8 opacity-90" alt="Logo" />
                    <span className="text-white font-extrabold text-xl tracking-tight">{shareName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500 font-bold text-base tracking-tight">coleciona.cards</span>
                    {chunks.length > 1 && (
                      <span className="bg-gray-800/50 text-gray-400 px-2 py-1 rounded text-xs font-bold">{previewIndex + 1} / {chunks.length}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Controles do Carrossel */}
            {chunks.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.preventDefault(); setPreviewIndex(prev => Math.max(0, prev - 1)); }}
                  disabled={previewIndex === 0}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:bg-brand/80 disabled:opacity-0 disabled:pointer-events-none z-20 group/btn"
                >
                  <ChevronLeft size={20} className="transition-transform group-hover/btn:-translate-x-0.5" />
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); setPreviewIndex(prev => Math.min(chunks.length - 1, prev + 1)); }}
                  disabled={previewIndex === chunks.length - 1}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all hover:bg-brand/80 disabled:opacity-0 disabled:pointer-events-none z-20 group/btn"
                >
                  <ChevronRight size={20} className="transition-transform group-hover/btn:translate-x-0.5" />
                </button>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                  {chunks.map((_, i) => (
                    <button 
                      key={i}
                      onClick={() => setPreviewIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === previewIndex ? "bg-brand w-4" : "bg-white/20 hover:bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}

            {generating && (
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50 text-white">
                <Loader2 className="animate-spin text-brand" size={40} />
                <p className="text-lg font-black uppercase tracking-[0.2em] mt-4 mb-1 text-center px-4">Gerando Imagens</p>
                <p className="text-[10px] font-bold text-white/50 tracking-widest uppercase">PROCESSO {progress.current} DE {progress.total}</p>
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-3 text-[10px] sm:text-[11px] font-medium text-text-tertiary px-2 bg-brand/5 p-3 sm:p-4 rounded-2xl border border-brand/10">
            <Info size={14} className="text-brand shrink-0 mt-0.5" />
            <p>O preview acima é uma representação idêntica ao arquivo final. Use as setas para visualizar todas as imagens que serão geradas.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function OptionToggle({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border-2 transition-all text-[10px] font-black uppercase tracking-[0.1em] ${
        active 
          ? "bg-brand/10 border-brand text-brand shadow-[0_0_20px_rgba(217,70,239,0.1)] scale-[1.02]" 
          : "bg-input-bg border-input-border text-text-tertiary hover:border-text-tertiary/50"
      }`}
    >
      <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${active ? "bg-brand border-brand" : "border-input-border"}`}>
        {active && <Check size={12} strokeWidth={4} className="text-white" />}
      </div>
      {label}
    </button>
  );
}

function PreviewCard({ item, options }: { item: CollectionItem, options: ShareOptions }) {
  const price = getItemPrice(item) || 0;
  const formattedPrice = formatBrl(price).replace("R$", "").trim();

  return (
    <div className="relative aspect-[240/335] group">
      <div className="absolute inset-0 bg-brand/20 blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl" />
      <img 
        src={item.card.imageSmall || ""} 
        className="w-full h-full object-contain rounded-2xl shadow-2xl transition-all duration-500 group-hover:scale-[1.05] group-hover:-translate-y-2 relative z-10"
        alt={item.card.name}
      />
      
      {/* Badge */}
      {(options.showNumber || options.showCondition || options.showLanguage || options.showPrice) && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-xl px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.4)] border border-gray-100 flex items-center gap-3 whitespace-nowrap min-w-[80%] justify-center z-20 transition-all duration-500 group-hover:shadow-brand/20 group-hover:border-brand/30">
          {options.showNumber && (
            <span className="text-[11px] font-black text-gray-900 border-r border-gray-200 pr-3 font-mono">
              {formatCardNumber(item.card.number, item.card.printedTotal)}
            </span>
          )}
          {options.showCondition && (
            <span className="text-[11px] font-black text-brand uppercase tracking-wider">
              {item.condition}
            </span>
          )}
          {options.showLanguage && (
            <span className="text-base filter drop-shadow-sm">
              {getLanguageFlag(item.language)}
            </span>
          )}
          {options.showPrice && (
            <span className="text-[14px] font-black text-gray-900 border-l border-gray-200 pl-3">
              {formattedPrice}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function renderCardHtml(item: any, options: ShareOptions, dataUrl: string): string {
  const price = getItemPrice(item) || 0;
  const formattedPrice = formatBrl(price).replace("R$", "").trim();
  const cardNumber = formatCardNumber(item.card.number, item.card.printedTotal);
  
  let badgeHtml = "";
  if (options.showNumber || options.showCondition || options.showLanguage || options.showPrice) {
    badgeHtml = `
      <div style="position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%); background: white; border-radius: 12px; padding: 10px 20px; box-shadow: 0 15px 30px -5px rgb(0 0 0 / 0.5); border: 1px solid #f3f4f6; display: flex; align-items: center; gap: 12px; white-space: nowrap; min-width: 75%; justify-content: center; z-index: 10;">
        ${options.showNumber ? `<span style="font-size: 14px; font-weight: 900; color: #111827; border-right: 2px solid #f3f4f6; padding-right: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${cardNumber}</span>` : ""}
        ${options.showCondition ? `<span style="font-size: 14px; font-weight: 900; color: #d946ef; text-transform: uppercase; font-family: sans-serif; tracking: 0.05em;">${item.condition}</span>` : ""}
        ${options.showLanguage ? `<span style="font-size: 20px;">${getLanguageFlag(item.language)}</span>` : ""}
        ${options.showPrice ? `<span style="font-size: 20px; font-weight: 900; color: #111827; border-left: 2px solid #f3f4f6; padding-left: 12px; font-family: sans-serif;">${formattedPrice}</span>` : ""}
      </div>
    `;
  }

  return `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column;">
      <img src="${dataUrl}" style="width: 100%; height: auto; border-radius: 20px; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.6);" />
      ${badgeHtml}
    </div>
  `;
}

function getItemPrice(item: CollectionItem): number | null {
  return item.store?.effectivePrice ?? item.customPrice ?? item.price?.amount ?? null;
}

function getLanguageFlag(language: string): string {
  switch (language) {
    case "pt-BR": return "🇧🇷";
    case "en": return "🇺🇸";
    case "ja": return "🇯🇵";
    default: return "🏳️";
  }
}
