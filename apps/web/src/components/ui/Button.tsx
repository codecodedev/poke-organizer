import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "brand" | "ghost" | "gradient";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  brand: "btn-brand",
  ghost: "btn-ghost",
  gradient: "btn-gradient h-12 px-6 rounded-2xl"
};

export function Button({ variant = "ghost", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`${variants[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}
