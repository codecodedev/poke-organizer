import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CollectionOfferStatus,
  NegotiationDetail,
  NegotiationMessage,
  NegotiationStatus,
  NegotiationSummary,
  OrderItem,
  OrderStatus,
} from "@poke-organizer/shared";
import { Prisma } from "@prisma/client";
import { EmailService } from "../email/email.service";
import { PrismaService } from "../prisma/prisma.service";
import { OrderService } from "../order/order.service";
import { NegotiationRealtimeService } from "./negotiation-realtime.service";

const offerInclude = {
  buyer: true,
  folder: { include: { user: true } },
  items: {
    include: {
      folderItem: {
        include: {
          collectionItem: { include: { card: true } },
        },
      },
    },
  },
  events: {
    include: { sender: true },
    orderBy: { createdAt: "asc" as const },
  },
  order: {
    include: {
      seller: true,
      buyer: true,
      items: true,
      messages: {
        include: { sender: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
} satisfies Prisma.CollectionCartOfferInclude;

const orderInclude = {
  seller: true,
  buyer: true,
  items: true,
  messages: {
    include: { sender: true },
    orderBy: { createdAt: "asc" as const },
  },
  proposal: {
    include: {
      buyer: true,
      folder: { include: { user: true } },
      items: {
        include: {
          folderItem: {
            include: {
              collectionItem: { include: { card: true } },
            },
          },
        },
      },
      events: {
        include: { sender: true },
        orderBy: { createdAt: "asc" as const },
      },
    },
  },
  auction: {
    include: {
      collectionItem: { include: { card: true } },
      seller: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OfferWithRelations = Prisma.CollectionCartOfferGetPayload<{ include: typeof offerInclude }>;
type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class NegotiationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly emailService: EmailService,
    private readonly realtime: NegotiationRealtimeService,
  ) {}

  async list(userId: string, tab: "sales" | "purchases" = "sales"): Promise<NegotiationSummary[]> {
    const [offers, auctionOrders] = await Promise.all([
      this.prisma.collectionCartOffer.findMany({
        where: tab === "sales" ? { folder: { userId } } : { buyerId: userId },
        include: offerInclude,
        orderBy: { updatedAt: "desc" },
      }),
      this.prisma.order.findMany({
        where: {
          auctionId: { not: null },
          ...(tab === "sales" ? { sellerId: userId } : { buyerId: userId }),
        },
        include: orderInclude,
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return [
      ...offers.map((offer) => this.mapOffer(offer, userId)),
      ...auctionOrders.map((order) => this.mapAuctionOrder(order, userId)),
    ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async getByKey(userId: string, key: string): Promise<NegotiationDetail> {
    const [origin, id] = this.parseKey(key);
    if (origin === "proposal") return this.getProposal(userId, id);
    if (origin === "auction") return this.getAuctionOrder(userId, id);
    return this.getByOrder(userId, id);
  }

  async getProposal(userId: string, offerId: string): Promise<NegotiationDetail> {
    const offer = await this.findOfferForUser(userId, offerId);
    return this.mapOffer(offer, userId, true);
  }

  async getAuctionOrder(userId: string, orderId: string): Promise<NegotiationDetail> {
    const order = await this.findOrderForUser(userId, orderId);
    if (!order.auctionId) throw new NotFoundException("Negociação de leilão não encontrada");
    return this.mapAuctionOrder(order, userId, true);
  }

  async getByOrder(userId: string, orderId: string): Promise<NegotiationDetail> {
    const order = await this.findOrderForUser(userId, orderId);
    if (order.proposalId) return this.getProposal(userId, order.proposalId);
    if (order.auctionId) return this.mapAuctionOrder(order, userId, true);
    throw new NotFoundException("Negociação não encontrada");
  }

  async addProposalMessage(userId: string, offerId: string, rawMessage: string): Promise<NegotiationDetail> {
    const message = rawMessage.trim();
    if (!message) throw new BadRequestException("Mensagem é obrigatória");

    const offer = await this.findOfferForUser(userId, offerId);
    if (!this.canChatOnOffer(offer)) {
      throw new BadRequestException("Esta negociação já foi encerrada");
    }

    const recipientId = userId === offer.buyerId ? offer.folder.userId : offer.buyerId;
    await this.prisma.$transaction(async (tx) => {
      await tx.collectionCartOfferEvent.create({
        data: {
          offerId,
          senderId: userId,
          type: "MESSAGE",
          message,
        },
      });
      await tx.notification.create({
        data: {
          userId: recipientId,
          title: "Nova mensagem na negociação",
          message: "Você recebeu uma nova mensagem em uma negociação.",
          link: `/?page=negotiations&negotiation=proposal:${offerId}`,
        },
      });
    });

    return this.emitProposal(userId, offerId);
  }

  async addAuctionMessage(userId: string, orderId: string, rawMessage: string): Promise<NegotiationDetail> {
    const order = await this.findOrderForUser(userId, orderId);
    if (!order.auctionId) throw new NotFoundException("Negociação de leilão não encontrada");
    if (order.status !== "PENDING") {
      throw new BadRequestException("Esta negociação já foi encerrada");
    }

    await this.orderService.createMessage(userId, orderId, rawMessage);
    return this.emitAuction(userId, orderId);
  }

  async counterProposal(
    userId: string,
    offerId: string,
    totalOffer: number,
    rawMessage?: string,
  ): Promise<NegotiationDetail> {
    const offer = await this.findOfferForUser(userId, offerId);
    if (offer.status === "ACCEPTED" || offer.status === "REJECTED" || offer.order) {
      throw new BadRequestException("Esta proposta já foi decidida");
    }

    const lastOfferSenderId = this.getLastOfferSenderId(offer);
    if (userId === lastOfferSenderId) {
      throw new BadRequestException("Aguarde a resposta da outra parte");
    }

    const totalOfferBrl = this.assertPositiveMoney(totalOffer);
    const message = rawMessage?.trim() || null;
    const isSeller = userId === offer.folder.userId;
    const recipientId = isSeller ? offer.buyerId : offer.folder.userId;

    await this.prisma.$transaction(async (tx) => {
      await tx.collectionCartOfferEvent.create({
        data: {
          offerId,
          senderId: userId,
          type: "COUNTER_OFFER",
          message,
          proposedTotalBrl: totalOfferBrl,
        },
      });
      await tx.collectionCartOffer.update({
        where: { id: offerId },
        data: {
          status: "COUNTERED",
          totalOfferBrl,
          decidedAt: null,
        },
      });
      await tx.notification.create({
        data: {
          userId: recipientId,
          title: "Contraproposta recebida",
          message: `${isSeller ? (offer.folder.user.name || offer.folder.user.email) : (offer.buyer.name || offer.buyer.email)} enviou uma contraproposta de R$ ${totalOfferBrl.toFixed(2)}.`,
          link: `/?page=negotiations&negotiation=proposal:${offerId}`,
        },
      });
    });

    return this.emitProposal(userId, offerId);
  }

  async respondCounterProposal(
    userId: string,
    offerId: string,
    status: "accepted" | "rejected",
    rawMessage?: string,
  ): Promise<NegotiationDetail> {
    const offer = await this.findOfferForUser(userId, offerId);
    if (offer.status !== "COUNTERED" && offer.status !== "PENDING") {
      throw new BadRequestException("Esta proposta não possui uma oferta pendente de resposta");
    }

    const lastOfferSenderId = this.getLastOfferSenderId(offer);
    if (userId === lastOfferSenderId) {
      throw new BadRequestException("Aguarde a resposta da outra parte");
    }

    const accepted = status === "accepted";
    const message = rawMessage?.trim() || null;
    const isSeller = userId === offer.folder.userId;
    const recipientId = isSeller ? offer.buyerId : offer.folder.userId;

    if (accepted && isSeller) {
      // Seller accepted buyer's proposal/counter -> Finalize
      await this.acceptProposal(offer);
    } else {
      await this.prisma.$transaction(async (tx) => {
        const type = accepted ? "BUYER_ACCEPTED" : "REJECTED";
        await tx.collectionCartOfferEvent.create({
          data: {
            offerId,
            senderId: userId,
            type,
            message,
            proposedTotalBrl: accepted ? offer.totalOfferBrl : null,
          },
        });
        await tx.collectionCartOffer.update({
          where: { id: offerId },
          data: {
            status: type,
            decidedAt: accepted ? null : new Date(),
          },
        });
        await tx.notification.create({
          data: {
            userId: recipientId,
            title: accepted ? "Proposta aceita" : "Proposta recusada",
            message: accepted
              ? `${offer.buyer.name || offer.buyer.email} aceitou sua contraproposta. Confirme para abrir o pedido.`
              : `${isSeller ? (offer.folder.user.name || offer.folder.user.email) : (offer.buyer.name || offer.buyer.email)} recusou a proposta.`,
            link: `/?page=negotiations&negotiation=proposal:${offerId}`,
          },
        });
      });
    }

    return this.emitProposal(userId, offerId);
  }

  async decideProposal(
    userId: string,
    offerId: string,
    status: "accepted" | "rejected",
  ): Promise<NegotiationDetail> {
    const offer = await this.findOfferForUser(userId, offerId);
    if (offer.folder.userId !== userId) throw new NotFoundException("Proposta não encontrada");
    if (offer.status === "ACCEPTED" || offer.status === "REJECTED" || offer.order) {
      throw new BadRequestException("Esta proposta já foi decidida");
    }
    
    // If it's COUNTERED and seller is deciding, it means seller is responding to Buyer's last counter-offer
    if (status === "accepted" && offer.status === "COUNTERED") {
      const lastOfferSenderId = this.getLastOfferSenderId(offer);
      if (lastOfferSenderId === userId) {
        throw new BadRequestException("Aguarde o comprador responder a contraproposta");
      }
    }

    if (status === "accepted") {
      await this.acceptProposal(offer);
    } else {
      await this.rejectProposal(offer, userId);
    }

    return this.emitProposal(userId, offerId);
  }

  async removeItemFromProposal(userId: string, offerId: string, itemId: string): Promise<NegotiationDetail> {
    const offer = await this.findOfferForUser(userId, offerId);
    if (offer.folder.userId !== userId) {
      throw new BadRequestException("Apenas o vendedor pode remover itens da proposta");
    }

    if (offer.status !== "PENDING" && offer.status !== "COUNTERED") {
      throw new BadRequestException("Itens só podem ser removidos durante a negociação ativa");
    }

    const item = offer.items.find(i => i.id === itemId);
    if (!item) {
      throw new NotFoundException("Item não encontrado nesta proposta");
    }

    if (offer.items.length <= 1) {
      throw new BadRequestException("A proposta deve ter pelo menos um item. Se desejar, recuse a proposta inteira.");
    }

    const newTotalBrl = Number(offer.totalOfferBrl) - Number(item.amountBrl);

    await this.prisma.$transaction(async (tx) => {
      await tx.collectionCartOfferItem.delete({
        where: { id: itemId },
      });

      await tx.collectionCartOffer.update({
        where: { id: offerId },
        data: {
          totalOfferBrl: newTotalBrl,
          status: "COUNTERED",
          updatedAt: new Date(),
        },
      });

      await tx.collectionCartOfferEvent.create({
        data: {
          offerId,
          senderId: userId,
          type: "MESSAGE",
          message: `O vendedor removeu o item "${item.folderItem.collectionItem.card.name}" da negociação. O novo total é ${newTotalBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        },
      });

      await tx.notification.create({
        data: {
          userId: offer.buyerId,
          title: "Item removido da negociação",
          message: `O vendedor removeu o item "${item.folderItem.collectionItem.card.name}" da sua proposta. O novo total é R$ ${newTotalBrl.toFixed(2)}.`,
          link: `/?page=negotiations&negotiation=proposal:${offerId}`,
        },
      });
    });

    return this.emitProposal(userId, offerId);
  }

  async updateOrderStatus(
    userId: string,
    origin: string,
    id: string,
    status: "delivered" | "cancelled",
  ): Promise<NegotiationDetail> {
    const detail = await this.getByOriginAndId(userId, origin, id);
    if (!detail.orderId) throw new BadRequestException("Esta negociação ainda não possui pedido");
    await this.orderService.updateStatus(userId, detail.orderId, status);

    if (status === "cancelled") {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const userName = user?.name || user?.email || "Vendedor";
      
      if (detail.origin === "proposal" && detail.proposalId) {
        await this.prisma.collectionCartOfferEvent.create({
          data: {
            offerId: detail.proposalId,
            senderId: userId,
            type: "MESSAGE",
            message: `${userName} cancelou o pedido.`,
          },
        });
      } else if (detail.origin === "auction") {
        await this.prisma.orderMessage.create({
          data: {
            orderId: detail.orderId,
            senderId: userId,
            message: `${userName} cancelou o pedido.`,
          },
        });
      }
    }

    if (detail.origin === "proposal" && detail.proposalId) {
      return this.emitProposal(userId, detail.proposalId);
    }
    return this.emitAuction(userId, detail.orderId);
  }

  private async getByOriginAndId(userId: string, origin: string, id: string): Promise<NegotiationDetail> {
    if (origin === "proposal") return this.getProposal(userId, id);
    if (origin === "auction") return this.getAuctionOrder(userId, id);
    if (origin === "order") return this.getByOrder(userId, id);
    throw new NotFoundException("Negociação não encontrada");
  }

  private async acceptProposal(offer: OfferWithRelations) {
    await this.prisma.$transaction(async (tx) => {
      await tx.collectionCartOfferEvent.create({
        data: {
          offerId: offer.id,
          senderId: offer.folder.userId,
          type: "SELLER_ACCEPTED",
          proposedTotalBrl: offer.totalOfferBrl,
        },
      });
      await tx.collectionCartOffer.update({
        where: { id: offer.id },
        data: { status: "ACCEPTED", decidedAt: new Date() },
      });
      await tx.order.create({
        data: {
          sellerId: offer.folder.userId,
          buyerId: offer.buyerId,
          status: "PENDING",
          totalAmountBrl: offer.totalOfferBrl,
          proposalId: offer.id,
          items: {
            create: offer.items.map((item) => ({
              name: item.folderItem.collectionItem.card.name,
              quantity: item.quantity,
              priceBrl: item.amountBrl,
              imageSmall: item.folderItem.collectionItem.card.imageSmall,
              condition: item.folderItem.collectionItem.condition,
              variant: item.folderItem.collectionItem.variant,
              cardNumber: item.folderItem.collectionItem.card.number,
              cardTotal: item.folderItem.collectionItem.card.printedTotal,
            })),
          },
        },
      });

      for (const offerItem of offer.items) {
        const availableQuantity = Math.max(0, offerItem.folderItem.quantity - offerItem.folderItem.soldQuantity);
        if (offerItem.quantity > availableQuantity) {
          throw new BadRequestException(`Quantidade indisponível para ${offerItem.folderItem.collectionItem.card.name}`);
        }
        const totalSoldNow = offerItem.folderItem.soldQuantity + offerItem.quantity;
        await tx.collectionFolderItem.update({
          where: { id: offerItem.folderItemId },
          data: {
            isSold: totalSoldNow >= offerItem.folderItem.quantity,
            soldQuantity: totalSoldNow,
            soldPriceBrl: offerItem.amountBrl,
            soldAt: new Date(),
            soldToUserId: offer.buyerId,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: offer.buyerId,
          title: "Proposta aceita",
          message: `Sua proposta na coleção "${offer.folder.name}" foi aceita. Acompanhe a entrega pela negociação.`,
          link: `/?page=negotiations&negotiation=proposal:${offer.id}`,
        },
      });
    });

    void this.emailService.sendProposalDecisionEmail(
      offer.buyer.email,
      offer.folder.user.name || offer.folder.user.email,
      offer.folder.name,
      "accepted",
      offer.id,
    ).catch(err => console.error("Failed to send accept email", err));
  }

  private async rejectProposal(offer: OfferWithRelations, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.collectionCartOfferEvent.create({
        data: {
          offerId: offer.id,
          senderId: userId,
          type: "REJECTED",
        },
      });
      await tx.collectionCartOffer.update({
        where: { id: offer.id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await tx.notification.create({
        data: {
          userId: offer.buyerId,
          title: "Proposta recusada",
          message: `Sua proposta na coleção "${offer.folder.name}" foi recusada pelo vendedor.`,
          link: `/?page=negotiations&negotiation=proposal:${offer.id}`,
        },
      });
    });

    void this.emailService.sendProposalDecisionEmail(
      offer.buyer.email,
      offer.folder.user.name || offer.folder.user.email,
      offer.folder.name,
      "rejected",
      offer.id,
    ).catch(err => console.error("Failed to send reject email", err));
  }

  private async emitProposal(userId: string, offerId: string): Promise<NegotiationDetail> {
    const detail = await this.getProposal(userId, offerId);
    this.realtime.emitNegotiationDetail(detail.id, detail);
    return detail;
  }

  private async emitAuction(userId: string, orderId: string): Promise<NegotiationDetail> {
    const detail = await this.getAuctionOrder(userId, orderId);
    this.realtime.emitNegotiationDetail(detail.id, detail);
    return detail;
  }

  private async findOfferForUser(userId: string, offerId: string): Promise<OfferWithRelations> {
    const offer = await this.prisma.collectionCartOffer.findFirst({
      where: {
        id: offerId,
        OR: [{ buyerId: userId }, { folder: { userId } }],
      },
      include: offerInclude,
    });
    if (!offer) throw new NotFoundException("Negociação não encontrada");
    return offer;
  }

  private async findOrderForUser(userId: string, orderId: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ sellerId: userId }, { buyerId: userId }],
      },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("Negociação não encontrada");
    return order;
  }

  private mapOffer(offer: OfferWithRelations, userId: string, detail?: false): NegotiationSummary;
  private mapOffer(offer: OfferWithRelations, userId: string, detail: true): NegotiationDetail;
  private mapOffer(offer: OfferWithRelations, userId: string, detail = false): NegotiationSummary | NegotiationDetail {
    const order = offer.order;
    const role = offer.folder.userId === userId ? "seller" : "buyer";
    const status = this.offerNegotiationStatus(offer);
    const summary: NegotiationSummary = {
      id: `proposal:${offer.id}`,
      origin: "proposal",
      role,
      proposalId: offer.id,
      orderId: order?.id ?? null,
      auctionId: null,
      sellerId: offer.folder.userId,
      sellerName: offer.folder.user.name || offer.folder.user.email,
      buyerId: offer.buyerId,
      buyerName: offer.buyer.name || offer.buyer.email,
      title: offer.folder.name,
      status,
      proposalStatus: this.mapOfferStatus(offer.status),
      orderStatus: order ? this.mapOrderStatus(order.status) : null,
      totalAmount: Number(order?.totalAmountBrl ?? offer.totalOfferBrl),
      createdAt: offer.createdAt.toISOString(),
      updatedAt: (order?.updatedAt ?? offer.updatedAt).toISOString(),
      items: order ? this.mapOrderItems(order.items) : this.mapOfferItems(offer),
    };

    if (!detail) return summary;

    const canChat = this.canChatOnOffer(offer);
    const messages = this.offerMessages(offer);
    const hasActiveOffer = offer.status === "PENDING" || offer.status === "COUNTERED" || offer.status === "BUYER_ACCEPTED";
    const latestAction = this.getLatestOfferAction(offer);
    const actionTargetUserId = canChat && !order && hasActiveOffer
      ? this.getOfferActionTargetUserId(offer, latestAction.senderId)
      : null;
    const isActionTarget = userId === actionTargetUserId;

    return {
      ...summary,
      messages,
      folderId: offer.folderId,
      folderName: offer.folder.name,
      folderShareToken: offer.folder.shareToken,
      isGlobalOffer: offer.isGlobalOffer,
      canChat,
      canSendCounterOffer: canChat && !order && hasActiveOffer && isActionTarget,
      canRespondCounterOffer: canChat && !order && offer.status === "COUNTERED" && isActionTarget,
      canAcceptProposal: role === "seller" && canChat && !order && hasActiveOffer && isActionTarget,
      canRejectProposal: canChat && !order && hasActiveOffer && isActionTarget,
      canUpdateOrderStatus: role === "seller" && order?.status === "PENDING",
      actionTargetUserId,
      actionMessageId: actionTargetUserId ? latestAction.messageId : null,
    };
  }

  private getLastOfferSenderId(offer: OfferWithRelations): string {
    return this.getLatestOfferAction(offer).senderId;
  }

  private getLatestOfferAction(offer: OfferWithRelations): { messageId: string; senderId: string } {
    const lastEvent = [...offer.events]
      .filter((event) =>
        event.type === "INITIAL_OFFER" ||
        event.type === "COUNTER_OFFER" ||
        event.type === "BUYER_ACCEPTED"
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return lastEvent
      ? { messageId: lastEvent.id, senderId: lastEvent.senderId }
      : { messageId: `initial:${offer.id}`, senderId: offer.buyerId };
  }

  private getOfferActionTargetUserId(offer: OfferWithRelations, senderId: string): string | null {
    if (senderId === offer.buyerId) return offer.folder.userId;
    if (senderId === offer.folder.userId) return offer.buyerId;
    return null;
  }


  private mapAuctionOrder(order: OrderWithRelations, userId: string, detail?: false): NegotiationSummary;
  private mapAuctionOrder(order: OrderWithRelations, userId: string, detail: true): NegotiationDetail;
  private mapAuctionOrder(order: OrderWithRelations, userId: string, detail = false): NegotiationSummary | NegotiationDetail {
    const role = order.sellerId === userId ? "seller" : "buyer";
    const summary: NegotiationSummary = {
      id: `auction:${order.id}`,
      origin: "auction",
      role,
      proposalId: null,
      orderId: order.id,
      auctionId: order.auctionId,
      sellerId: order.sellerId,
      sellerName: order.seller.name || order.seller.email,
      buyerId: order.buyerId,
      buyerName: order.buyer.name || order.buyer.email,
      title: order.auction?.title || order.items[0]?.name || "Leilão",
      status: this.mapOrderStatus(order.status),
      proposalStatus: null,
      orderStatus: this.mapOrderStatus(order.status),
      totalAmount: Number(order.totalAmountBrl),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: this.mapOrderItems(order.items),
    };

    if (!detail) return summary;

    return {
      ...summary,
      messages: (order.messages ?? []).map((message): NegotiationMessage => ({
        id: message.id,
        senderId: message.senderId,
        senderName: message.sender?.name || message.sender?.email || "Usuário",
        type: "order_message",
        message: message.message,
        proposedTotal: null,
        createdAt: message.createdAt.toISOString(),
      })),
      canChat: order.status === "PENDING",
      canSendCounterOffer: false,
      canRespondCounterOffer: false,
      canAcceptProposal: false,
      canRejectProposal: false,
      canUpdateOrderStatus: role === "seller" && order.status === "PENDING",
    };
  }

  private offerMessages(offer: OfferWithRelations): NegotiationMessage[] {
    const proposalEvents = (offer.events ?? []).map((event): NegotiationMessage => ({
      id: event.id,
      senderId: event.senderId,
      senderName: event.sender.name || event.sender.email,
      type: this.mapEventType(event.type),
      message: event.message,
      proposedTotal: event.proposedTotalBrl === null || event.proposedTotalBrl === undefined
        ? null
        : Number(event.proposedTotalBrl),
      createdAt: event.createdAt.toISOString(),
    }));

    const hasInitialOfferEvent = (offer.events ?? []).some((event) => event.type === "INITIAL_OFFER");
    const initial = hasInitialOfferEvent ? [] : [{
      id: `initial:${offer.id}`,
      senderId: offer.buyerId,
      senderName: offer.buyer.name || offer.buyer.email,
      type: "initial_offer" as const,
      message: offer.message,
      proposedTotal: Number(offer.totalOfferBrl),
      createdAt: offer.createdAt.toISOString(),
    }];

    const orderMessages = (offer.order?.messages ?? []).map((message): NegotiationMessage => ({
      id: `order:${message.id}`,
      senderId: message.senderId,
      senderName: message.sender?.name || message.sender?.email || "Usuário",
      type: "order_message",
      message: message.message,
      proposedTotal: null,
      createdAt: message.createdAt.toISOString(),
    }));

    return [...initial, ...proposalEvents, ...orderMessages]
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  private canChatOnOffer(offer: OfferWithRelations) {
    if (offer.status === "REJECTED") return false;
    if (!offer.order) return true;
    return offer.order.status === "PENDING";
  }

  private offerNegotiationStatus(offer: OfferWithRelations): NegotiationStatus {
    if (offer.order) return this.mapOrderNegotiationStatus(offer.order.status);
    return this.mapOfferStatus(offer.status);
  }

  private mapOfferStatus(status: string): CollectionOfferStatus {
    if (status === "ACCEPTED") return "accepted";
    if (status === "REJECTED") return "rejected";
    if (status === "COUNTERED") return "countered";
    if (status === "BUYER_ACCEPTED") return "buyer_accepted";
    return "pending";
  }

  private mapOrderStatus(status: string): OrderStatus {
    if (status === "DELIVERED") return "delivered";
    if (status === "CANCELLED") return "cancelled";
    return "pending";
  }

  private mapOrderNegotiationStatus(status: string): NegotiationStatus {
    if (status === "DELIVERED") return "delivered";
    if (status === "CANCELLED") return "cancelled";
    return "accepted";
  }

  private mapEventType(type: string): NegotiationMessage["type"] {
    if (type === "INITIAL_OFFER") return "initial_offer";
    if (type === "COUNTER_OFFER") return "counter_offer";
    if (type === "BUYER_ACCEPTED") return "buyer_accepted";
    if (type === "SELLER_ACCEPTED") return "seller_accepted";
    if (type === "REJECTED") return "rejected";
    if (type === "CANCELLED") return "cancelled";
    return "message";
  }

  private mapOfferItems(offer: OfferWithRelations): OrderItem[] {
    return offer.items.map((item) => ({
      id: item.id,
      name: item.folderItem.collectionItem.card.name,
      quantity: item.quantity,
      price: Number(item.amountBrl),
      imageSmall: item.folderItem.collectionItem.card.imageSmall,
      condition: item.folderItem.collectionItem.condition,
      variant: item.folderItem.collectionItem.variant,
      language: item.folderItem.collectionItem.language,
      cardNumber: item.folderItem.collectionItem.card.number,
      cardTotal: item.folderItem.collectionItem.card.printedTotal,
    }));
  }

  private mapOrderItems(items: OrderWithRelations["items"]): OrderItem[] {
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.priceBrl),
      imageSmall: item.imageSmall,
      condition: item.condition,
      variant: item.variant,
      language: (item as any).language,
      cardNumber: item.cardNumber,
      cardTotal: item.cardTotal,
    }));
  }

  private parseKey(key: string): [string, string] {
    const [origin, ...rest] = key.split(":");
    const id = rest.join(":");
    if (!origin || !id) throw new NotFoundException("Negociação não encontrada");
    return [origin, id];
  }

  private assertPositiveMoney(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException("Informe um valor maior que zero");
    }
    return Math.round(value * 100) / 100;
  }
}
