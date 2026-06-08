import { Modal } from "./Modal";
import { Button } from "./Button";

type ConfirmationModalProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmVariant?: "primary" | "brand" | "ghost" | "gradient";
};

export function ConfirmationModal({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
  confirmVariant = "brand",
}: ConfirmationModalProps) {
  return (
    <Modal title={title} onClose={onCancel} maxWidthClass="max-w-md">
      <div className="p-6">
        <p className="text-slate-600 dark:text-slate-400 font-medium mb-8">
          {description}
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} className="flex-1 sm:flex-none border border-line dark:border-white/10">
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} className="flex-1 sm:flex-none">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
