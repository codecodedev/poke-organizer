import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

@Injectable()
export class EmailService {
  private resend: Resend;
  private readonly brandColor = "#22d3ee"; // Cyan
  private readonly brandGradient = "linear-gradient(to bottom right, #22d3ee, #d946ef)";

  constructor(private config: ConfigService) {
    const apiKey = this.config.get("RESEND_API_KEY");
    this.resend = new Resend(apiKey);
    
    if (!apiKey) {
      console.warn("[EmailService] RESEND_API_KEY not found. Emails will fail to send.");
    } else {
      console.log("[EmailService] Resend initialized (HTTP API mode)");
    }
  }

  private wrapHtml(content: string, previewText: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f1f5f9; }
          .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; }
          .header { background-color: #0f172a; padding: 48px 24px; text-align: center; }
          .content { padding: 48px 32px; }
          .footer { padding: 32px 24px; text-align: center; font-size: 12px; color: #94a3b8; background: #f8fafc; border-top: 1px solid #e2e8f0; }
          .button { display: inline-block; padding: 16px 32px; background-color: #22d3ee; background-image: linear-gradient(to bottom right, #22d3ee, #d946ef); color: #ffffff !important; text-decoration: none; border-radius: 14px; font-weight: 900; margin: 24px 0; text-transform: uppercase; letter-spacing: 0.05em; font-size: 14px; }
          .logo-text { color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; }
          .logo-dot { color: #22d3ee; }
          h1 { color: #0f172a; font-size: 28px; font-weight: 900; margin-top: 0; margin-bottom: 24px; letter-spacing: -0.02em; line-height: 1.2; }
          p { margin: 16px 0; font-size: 16px; color: #475569; }
          strong { color: #0f172a; }
          .highlight-box { background: #f8fafc; border-radius: 16px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0; }
          .price-text { font-size: 24px; font-weight: 900; color: #10b981; }
        </style>
      </head>
      <body>
        <div style="display: none; max-height: 0px; overflow: hidden;">${previewText}</div>
        <div class="container">
          <div class="header">
            <div class="logo-text">coleciona<span class="logo-dot">.</span>cards</div>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p style="margin: 0 0 12px 0;"><strong>Coleciona Cards</strong></p>
            <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} Todos os direitos reservados.</p>
            <p style="margin: 0;">Você recebeu este e-mail porque está cadastrado em nossa plataforma.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getBaseUrl() {
    const frontUrl = this.config.get<string>("FRONT_URL");
    const webOrigin = this.config.get<string>("WEB_ORIGIN");
    
    const rawUrl = frontUrl || webOrigin || "http://localhost:5173";
    
    // Se for uma lista (comum em WEB_ORIGIN para CORS), pega o primeiro
    const firstUrl = rawUrl.split(",")[0].trim();
    
    // Proteção contra a string literal "undefined" que pode vir de envs mal configurados
    if (firstUrl === "undefined" || !firstUrl) {
      return "http://localhost:5173";
    }
    
    return firstUrl;
  }

  async sendWelcomeEmail(email: string, name: string, token: string) {
    const baseUrl = this.getBaseUrl();
    const confirmUrl = `${baseUrl}/confirm-email?token=${token}`;

    const html = this.wrapHtml(`
      <h1>Seja bem-vindo, ${name.split(" ")[0]}!</h1>
      <p>Estamos muito felizes em ter você no <strong>Coleciona Cards</strong>. Nossa missão é ajudar você a organizar, valorizar e negociar sua coleção de Pokémon TCG com facilidade.</p>
      <p>Para desbloquear todas as funcionalidades, confirme seu e-mail clicando no botão abaixo:</p>
      <div style="text-align: center;">
        <a href="${confirmUrl}" class="button">Confirmar meu E-mail</a>
      </div>
      <p style="font-size: 13px; color: #94a3b8; text-align: center;">Se o botão não funcionar, copie e cole este link:<br/>${confirmUrl}</p>
    `, "Bem-vindo ao Coleciona Cards! Confirme seu e-mail.");

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: "Seja bem-vindo! Confirme seu e-mail",
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Welcome email sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send welcome email to ${email}:`, error);
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const baseUrl = this.getBaseUrl();
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    const html = this.wrapHtml(`
      <h1>Recuperação de Senha</h1>
      <p>Recebemos uma solicitação para redefinir a senha da sua conta no Coleciona Cards.</p>
      <p>Clique no botão abaixo para escolher uma nova senha. <strong>Este link é válido por 1 hora.</strong></p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">Redefinir Senha</a>
      </div>
      <p>Se você não solicitou a alteração, ignore este e-mail. Sua senha atual continuará funcionando.</p>
    `, "Link para redefinir sua senha no Coleciona Cards");

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: "Recuperação de Senha",
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Password reset email sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send password reset email to ${email}:`, error);
    }
  }

  async sendNewBidEmail(email: string, auctionTitle: string, amount: number, shareToken: string) {
    const baseUrl = this.getBaseUrl();
    const auctionUrl = `${baseUrl}/auctions/${shareToken}`;

    const html = this.wrapHtml(`
      <h1>Novo lance recebido!</h1>
      <p>Ótimas notícias! Seu leilão <strong>"${auctionTitle}"</strong> acaba de receber uma nova oferta.</p>
      <div class="highlight-box" style="text-align: center;">
        <p style="margin: 0; text-transform: uppercase; font-size: 12px; font-weight: 900; color: #94a3b8;">Lance Atual</p>
        <p class="price-text" style="margin: 8px 0 0 0;">R$ ${amount.toFixed(2).replace(".", ",")}</p>
      </div>
      <p>O leilão está ficando movimentado. Fique de olho para não perder nenhuma atualização!</p>
      <div style="text-align: center;">
        <a href="${auctionUrl}" class="button">Ver meu Leilão</a>
      </div>
    `, `Novo lance de R$ ${amount.toFixed(2)} no seu leilão!`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: "Novo lance no seu leilão!",
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Bid notification sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send bid notification to ${email}:`, error);
    }
  }

  private renderItemsTable(items: any[]) {
    if (!items || items.length === 0) return "";

    const rows = items.map(item => {
      const card = item.folderItem?.collectionItem?.card || item.item?.card;
      const imageUrl = card?.imageUrl || "";
      const name = card?.name || "Carta Desconhecida";
      const setCode = card?.setCode || "";
      const quantity = item.quantity || 1;
      const amount = item.amountBrl || item.amount || 0;

      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
            <div style="display: flex; align-items: center;">
              ${imageUrl ? `<img src="${imageUrl}" style="width: 40px; height: 56px; object-fit: contain; border-radius: 4px; margin-right: 12px; background: #f8fafc; border: 1px solid #e2e8f0;" />` : ""}
              <div>
                <div style="font-weight: 900; color: #0f172a; font-size: 14px;">${quantity}x ${name}</div>
                <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">${setCode}</div>
              </div>
            </div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 700; color: #475569; font-size: 14px;">
            R$ ${Number(amount).toFixed(2).replace(".", ",")}
          </td>
        </tr>
      `;
    }).join("");

    return `
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
        <thead>
          <tr>
            <th style="text-align: left; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 8px; border-bottom: 2px solid #f1f5f9;">Item</th>
            <th style="text-align: right; font-size: 10px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; padding-bottom: 8px; border-bottom: 2px solid #f1f5f9;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  }

  async sendNewProposalEmail(email: string, buyerName: string, folderName: string, total: number, folderId: string, items: any[] = []) {
    const baseUrl = this.getBaseUrl();
    const proposalUrl = `${baseUrl}/?page=proposals`;

    const itemsHtml = this.renderItemsTable(items);

    const html = this.wrapHtml(`
      <h1>Nova proposta recebida!</h1>
      <p>O colecionador <strong>${buyerName}</strong> enviou uma proposta pela sua pasta <strong>"${folderName}"</strong>.</p>
      
      ${itemsHtml}

      <div class="highlight-box" style="text-align: center;">
        <p style="margin: 0; text-transform: uppercase; font-size: 12px; font-weight: 900; color: #94a3b8;">Valor Total da Proposta</p>
        <p class="price-text" style="margin: 8px 0 0 0;">R$ ${total.toFixed(2).replace(".", ",")}</p>
      </div>
      
      <p>Acesse sua conta para revisar os itens da proposta e responder ao interessado.</p>
      <div style="text-align: center;">
        <a href="${proposalUrl}" class="button">Analisar Proposta</a>
      </div>
    `, `Nova proposta de R$ ${total.toFixed(2)} recebida!`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: "Você recebeu uma nova proposta!",
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Proposal notification sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send proposal notification to ${email}:`, error);
    }
  }

  async sendProposalDecisionEmail(email: string, sellerName: string, folderName: string, status: "accepted" | "rejected") {
    const isAccepted = status === "accepted";
    const baseUrl = this.getBaseUrl();
    const targetUrl = isAccepted ? `${baseUrl}/?page=orders&tab=purchases` : `${baseUrl}/?page=proposals`;
    
    const html = this.wrapHtml(`
      <h1>Sua proposta foi ${isAccepted ? "aceita" : "recusada"}</h1>
      <p><strong>${sellerName}</strong> avaliou sua proposta pela pasta <strong>"${folderName}"</strong> e decidiu <strong>${isAccepted ? "ACEITAR" : "RECUSAR"}</strong>.</p>
      ${isAccepted 
        ? `
          <div class="highlight-box" style="background: #ecfdf5; border-color: #10b981;">
            <p style="margin: 0; color: #065f46;"><strong>Parabéns!</strong> Um novo pedido foi aberto em sua conta.</p>
            <p style="margin: 12px 0 0 0; font-size: 14px; color: #047857;">O próximo passo é abrir o pedido e usar a conversa da plataforma para combinar pagamento, entrega e detalhes finais.</p>
          </div>
        ` 
        : "<p>Não foi dessa vez. Você pode tentar enviar uma nova proposta com um valor diferente ou buscar outros itens no catálogo.</p>"}
      <div style="text-align: center;">
        <a href="${targetUrl}" class="button">${isAccepted ? "Ver Meu Pedido" : "Ver Detalhes"}</a>
      </div>
    `, `Sua proposta foi ${isAccepted ? "aceita" : "recusada"}`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: `Sua proposta foi ${isAccepted ? "aceita" : "recusada"}!`,
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Proposal decision notification sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send decision notification to ${email}:`, error);
    }
  }

  async sendAuctionWinnerEmail(email: string, sellerName: string, auctionTitle: string, amount: number) {
    const baseUrl = this.getBaseUrl();
    const ordersUrl = `${baseUrl}/?page=orders&tab=purchases`;

    const html = this.wrapHtml(`
      <h1>Você venceu o leilão!</h1>
      <p>Parabéns! Seu lance foi o vencedor no leilão <strong>"${auctionTitle}"</strong>.</p>
      <div class="highlight-box" style="text-align: center;">
        <p style="margin: 0; text-transform: uppercase; font-size: 12px; font-weight: 900; color: #94a3b8;">Lance Vencedor</p>
        <p class="price-text" style="margin: 8px 0 0 0;">R$ ${amount.toFixed(2).replace(".", ",")}</p>
      </div>
      <p>Use a conversa do pedido dentro da plataforma para combinar os detalhes finais com <strong>${sellerName}</strong>.</p>
      <div style="text-align: center;">
        <a href="${ordersUrl}" class="button">Ver meu Pedido</a>
      </div>
    `, `Parabéns! Você venceu o leilão "${auctionTitle}"!`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: `Você venceu o leilão: ${auctionTitle}!`,
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Auction winner email sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send auction winner email to ${email}:`, error);
    }
  }

  async sendOrderStatusEmail(email: string, orderId: string, status: "delivered" | "cancelled") {
    const isDelivered = status === "delivered";
    const statusText = isDelivered ? "ENTREGUE" : "CANCELADO";
    const baseUrl = this.getBaseUrl();

    const html = this.wrapHtml(`
      <h1>Status do Pedido Atualizado</h1>
      <p>O pedido <strong>#${orderId.slice(-6).toUpperCase()}</strong> foi marcado como <strong>${statusText}</strong> pelo vendedor.</p>
      <div class="highlight-box">
        <p style="margin: 0;">Você pode acompanhar todos os seus pedidos e conversar com os vendedores diretamente na plataforma.</p>
      </div>
      <div style="text-align: center;">
        <a href="${baseUrl}/?page=orders" class="button">Ver Meus Pedidos</a>
      </div>
    `, `Seu pedido #${orderId.slice(-6).toUpperCase()} foi ${statusText.toLowerCase()}`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: `Pedido #${orderId.slice(-6).toUpperCase()} ${statusText.toLowerCase()}`,
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Order status email sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send order status email to ${email}:`, error);
    }
  }

  async sendOrderMessageEmail(email: string, orderId: string, senderName: string) {
    const baseUrl = this.getBaseUrl();
    const orderUrl = `${baseUrl}/?page=orders&order=${encodeURIComponent(orderId)}`;
    const orderCode = orderId.slice(-6).toUpperCase();

    const html = this.wrapHtml(`
      <h1>Nova mensagem no pedido #${orderCode}</h1>
      <p><strong>${senderName}</strong> enviou uma mensagem sobre o pedido <strong>#${orderCode}</strong>.</p>
      <div class="highlight-box">
        <p style="margin: 0;">A conversa acontece dentro do Coleciona Cards para proteger os dados de contato de comprador e vendedor.</p>
      </div>
      <div style="text-align: center;">
        <a href="${orderUrl}" class="button">Abrir conversa</a>
      </div>
    `, `Nova mensagem no pedido #${orderCode}`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.config.get("SMTP_FROM") || "Coleciona Cards <onboarding@resend.dev>",
        to: [email],
        subject: `Nova mensagem no pedido #${orderCode}`,
        html,
      });

      if (error) {
        throw error;
      }

      console.log(`[EmailService] Order message email sent successfully to ${email} (ID: ${data?.id})`);
    } catch (error) {
      console.error(`[EmailService] Failed to send order message email to ${email}:`, error);
    }
  }
}
