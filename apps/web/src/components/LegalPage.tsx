import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { LEGAL_PRIVACY_VERSION, LEGAL_TERMS_VERSION } from "@poke-organizer/shared";

type Props = {
  type: "terms" | "privacy";
  onBack: () => void;
};

export function LegalPage({ type, onBack }: Props) {
  const isTerms = type === "terms";

  return (
    <section className="mx-auto w-full max-w-4xl px-5 py-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 rounded-2xl border border-card-border bg-card px-4 py-2 text-sm font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft size={18} />
        Voltar
      </button>

      <article className="rounded-[28px] border border-card-border bg-card p-6 shadow-sm sm:p-10">
        <div className="mb-8 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Versão {isTerms ? LEGAL_TERMS_VERSION : LEGAL_PRIVACY_VERSION}
            </p>
            <h1 className="mt-1 text-3xl font-black text-foreground">
              {isTerms ? "Termos de Uso" : "Política de Privacidade"}
            </h1>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {isTerms
                ? "Regras básicas para uso da plataforma, anúncios, propostas, negociações e pedidos."
                : "Como tratamos dados pessoais para operar conta, coleção, negociações, segurança e notificações."}
            </p>
          </div>
        </div>

        {isTerms ? <TermsContent /> : <PrivacyContent />}
      </article>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-card-border/50 py-6 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-black text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm font-medium leading-6 text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function TermsContent() {
  return (
    <div>
      <Section title="1. Papel da plataforma">
        <p>
          O Coleciona Cards atua como plataforma de organização, divulgação e conexão entre colecionadores. A plataforma não é parte vendedora, compradora, leiloeira oficial, instituição financeira ou intermediadora de pagamento.
        </p>
        <p>
          Negociação final, pagamento, envio, entrega e conferência dos itens são de responsabilidade exclusiva dos usuários envolvidos.
        </p>
      </Section>

      <Section title="2. Propostas e lances">
        <p>
          Propostas e lances representam intenção de negociação entre usuários. Eles não constituem garantia de compra, venda, pagamento, entrega ou autenticação do item.
        </p>
        <p>
          Ao enviar uma proposta ou lance, o usuário declara que pretende negociar de boa-fé e que entende que os detalhes finais devem ser combinados entre comprador e vendedor dentro da plataforma.
        </p>
      </Section>

      <Section title="3. Itens anunciados">
        <p>
          O usuário anunciante é responsável pelas informações, imagens, estado de conservação, disponibilidade, procedência e autenticidade dos itens divulgados.
        </p>
        <p>
          O Coleciona Cards não garante autenticidade, condição, valor de mercado, procedência ou disponibilidade de cartas e coleções anunciadas por usuários.
        </p>
      </Section>

      <Section title="4. Conduta dos usuários">
        <p>
          É proibido publicar informações falsas, usar a plataforma para fraude, assédio, spam, tentativa de golpe, venda de item falso ou qualquer conduta que comprometa a segurança da comunidade.
        </p>
        <p>
          A plataforma poderá remover conteúdo, limitar funcionalidades, bloquear usuários ou tomar medidas adicionais quando identificar uso indevido.
        </p>
      </Section>

      <Section title="5. Comunicação e pedidos">
        <p>
          A conversa de pedidos deve ser usada para combinar detalhes finais sem expor dados pessoais fora da plataforma. Evite compartilhar dados sensíveis desnecessários.
        </p>
        <p>
          Se houver suspeita de fraude, produto falso ou descumprimento de acordo, o usuário deve guardar evidências e acionar os canais de suporte disponíveis.
        </p>
      </Section>

      <Section title="6. Alterações">
        <p>
          Estes termos podem ser atualizados para refletir mudanças no produto, segurança, exigências legais ou regras de comunidade. Quando necessário, um novo aceite poderá ser solicitado.
        </p>
      </Section>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div>
      <Section title="1. Dados tratados">
        <p>
          Podemos tratar dados de cadastro, autenticação, perfil, coleções, anúncios, propostas, lances, pedidos, mensagens, notificações, registros técnicos de acesso e informações necessárias para segurança da plataforma.
        </p>
      </Section>

      <Section title="2. Finalidades">
        <p>
          Os dados são usados para criar e proteger contas, organizar coleções, exibir anúncios autorizados, viabilizar propostas e pedidos, enviar notificações, prevenir abuso, melhorar o serviço e cumprir obrigações legais.
        </p>
      </Section>

      <Section title="3. Compartilhamento">
        <p>
          Dados podem ser exibidos a outros usuários quando necessários para funcionamento de perfis públicos, coleções compartilhadas, negociações, propostas, lances e pedidos.
        </p>
        <p>
          Também podemos usar provedores de infraestrutura, e-mail, hospedagem, banco de dados e serviços de segurança, sempre limitados às finalidades da plataforma.
        </p>
      </Section>

      <Section title="4. Direitos do titular">
        <p>
          O usuário pode solicitar acesso, correção, exclusão, revisão ou informações sobre o tratamento de seus dados pessoais, conforme aplicável pela legislação brasileira de proteção de dados.
        </p>
      </Section>

      <Section title="5. Segurança e retenção">
        <p>
          Adotamos medidas técnicas e organizacionais razoáveis para proteger dados pessoais. Os dados são mantidos pelo tempo necessário para operação da conta, segurança, auditoria, cumprimento legal e prevenção de fraude.
        </p>
      </Section>

      <Section title="6. Cookies e tecnologias similares">
        <p>
          A plataforma pode usar armazenamento local, sessão e tecnologias similares para login, preferências, carrinho, experiência de uso e segurança. Cookies ou ferramentas não essenciais podem exigir aviso ou consentimento específico quando forem adotados.
        </p>
      </Section>
    </div>
  );
}
