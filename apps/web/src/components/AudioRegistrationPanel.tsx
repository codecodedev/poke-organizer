import { useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import type { Session } from "../lib/api";
import { Button } from "./ui/Button";
import { AudioRegistrationModal } from "./audio/AudioRegistrationModal";

type Props = {
  session: Session;
  onSession: (session: Session) => void;
  onUnauthorized: () => Promise<Session | null>;
  onAdded: () => void;
};

export function AudioRegistrationPanel(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
        <div className="mb-4 flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-aqua/20 text-cyan-700">
            <Mic size={22} />
          </div>
          <div>
            <p className="text-base font-black text-ink">Cadastro por voz</p>
            <p className="mt-1 text-sm leading-5 text-slate-600">A maneira mais rápida de cadastrar uma grande quantidade de cartas.</p>
          </div>
        </div>
        <Button type="button" variant="brand" icon={<Sparkles size={18} />} className="w-full" onClick={() => setOpen(true)}>
          Cadastrar por voz
        </Button>

      {open && <AudioRegistrationModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
