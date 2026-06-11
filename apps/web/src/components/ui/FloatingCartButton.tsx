import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";

type Props = {
  onClick: () => void;
  className?: string;
  currentCollectionToken?: string;
};

export function FloatingCartButton({ onClick, className = "", currentCollectionToken }: Props) {
  const [cartCount, setCartCount] = useState(0);
  const [hasCurrentCart, setHasCurrentCart] = useState(false);

  useEffect(() => {
    function checkCarts() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i) || "");
      }

      // Identificar tokens únicos de coleções que têm algo no carrinho
      const cartTokens = new Set<string>();
      let currentHasItems = false;
      
      keys.forEach(key => {
        try {
          if (key.startsWith("cart_")) {
            if (key.includes("_global_mode_")) {
              const token = key.replace("cart_global_mode_", "");
              if (localStorage.getItem(key) === "true") {
                cartTokens.add(token);
                if (token === currentCollectionToken) currentHasItems = true;
              }
            } else if (!key.includes("_global_")) {
              const token = key.replace("cart_", "");
              const cartStr = localStorage.getItem(key);
              if (cartStr) {
                const cart = JSON.parse(cartStr);
                if (cart && typeof cart === "object" && Object.keys(cart).length > 0) {
                  cartTokens.add(token);
                  if (token === currentCollectionToken) currentHasItems = true;
                }
              }
            }
          }
        } catch (e) {
          console.error("Error parsing cart from localStorage", e);
        }
      });
      
      setCartCount(cartTokens.size);
      setHasCurrentCart(currentHasItems);
    }

    checkCarts();
    
    // Listen for storage changes in other tabs
    window.addEventListener("storage", checkCarts);
    
    // Check periodically for changes in the same tab
    const interval = setInterval(checkCarts, 1000);

    return () => {
      window.removeEventListener("storage", checkCarts);
      clearInterval(interval);
    };
  }, [currentCollectionToken]);

  if (cartCount === 0 || hasCurrentCart) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-glow shadow-brand/20 transition-all hover:scale-110 active:scale-95 ${className}`}
      title="Meus Carrinhos"
    >
      <ShoppingCart size={22} className="group-hover:animate-bounce" />
      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-magenta text-[10px] font-black text-white shadow-sm ring-2 ring-background">
        {cartCount}
      </span>
    </button>
  );
}
