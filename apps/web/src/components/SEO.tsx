import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const DEFAULT_TITLE = "Coleciona cards";
const DEFAULT_DESCRIPTION = "A plataforma definitiva para colecionadores de Pokémon TCG. Organize sua coleção, acompanhe valores em tempo real e negocie com facilidade.";
const DEFAULT_IMAGE = "https://coleciona.cards/images/visual-identity.png";
const BASE_URL = "https://coleciona.cards";

export function SEO({ 
  title, 
  description, 
  image, 
  url 
}: SEOProps) {
  useEffect(() => {
    const displayTitle = title ? `${title} | Coleciona cards` : DEFAULT_TITLE;
    const displayDescription = description || DEFAULT_DESCRIPTION;
    const displayImage = image || DEFAULT_IMAGE;
    const displayUrl = url ? `${BASE_URL}${url}` : BASE_URL;

    document.title = displayTitle;

    const updateMeta = (selector: string, attr: string, value: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        const [type, name] = selector.includes("property") 
          ? ["property", selector.match(/"([^"]+)"/)?.[1]] 
          : ["name", selector.match(/"([^"]+)"/)?.[1]];
        
        if (type && name) {
          element.setAttribute(type, name);
          document.head.appendChild(element);
        }
      }
      element.setAttribute(attr, value);
    };

    updateMeta('meta[name="description"]', "content", displayDescription);
    updateMeta('meta[property="og:title"]', "content", displayTitle);
    updateMeta('meta[property="og:description"]', "content", displayDescription);
    updateMeta('meta[property="og:image"]', "content", displayImage);
    updateMeta('meta[property="og:url"]', "content", displayUrl);
    updateMeta('meta[property="twitter:title"]', "content", displayTitle);
    updateMeta('meta[property="twitter:description"]', "content", displayDescription);
    updateMeta('meta[property="twitter:image"]', "content", displayImage);
  }, [title, description, image, url]);

  return null;
}
