import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderDetail, OrderMessage, OrderSummary, OrderStatus } from "@poke-organizer/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { OrderRealtimeService } from "./order-realtime.service";

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  async listMySales(userId: string): Promise<OrderSummary[]> {
    const orders = await this.prisma.order.findMany({
      where: { sellerId: userId },
      include: {
        seller: true,
        buyer: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return orders.map((o) => this.mapOrder(o));
  }

  async listMyPurchases(userId: string): Promise<OrderSummary[]> {
    const orders = await this.prisma.order.findMany({
      where: { buyerId: userId },
      include: {
        seller: true,
        buyer: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return orders.map((o) => this.mapOrder(o));
  }

  async getOrder(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ sellerId: userId }, { buyerId: userId }],
      },
      include: {
        seller: true,
        buyer: true,
        items: true,
        messages: {
          include: { sender: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) throw new NotFoundException("Pedido não encontrado");

    return this.mapOrderDetail(order);
  }

  async createMessage(userId: string, orderId: string, rawMessage: string): Promise<OrderDetail> {
    const message = rawMessage.trim();
    if (!message) {
      throw new BadRequestException("Mensagem é obrigatória");
    }

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        OR: [{ sellerId: userId }, { buyerId: userId }],
      },
      include: {
        seller: true,
        buyer: true,
        messages: true,
      },
    });

    if (!order) throw new NotFoundException("Pedido não encontrado");

    const isFirstMessage = order.messages.length === 0;
    const recipient = userId === order.sellerId ? order.buyer : order.seller;
    const sender = userId === order.sellerId ? order.seller : order.buyer;

    await this.prisma.orderMessage.create({
      data: {
        orderId,
        senderId: userId,
        message,
      },
    });

    if (isFirstMessage) {
      const orderCode = orderId.slice(-6).toUpperCase();
      await this.prisma.notification.create({
        data: {
          userId: recipient.id,
          title: "Nova mensagem no pedido",
          message: `${sender.name || sender.email} enviou uma mensagem sobre o pedido #${orderCode}.`,
          link: `/?page=orders&order=${orderId}`,
        },
      });

      void this.emailService.sendOrderMessageEmail(
        recipient.email,
        orderId,
        sender.name || sender.email,
      ).catch(err => console.error("Failed to send order message email", err));
    }

    const detail = await this.getOrder(userId, orderId);
    this.realtime.emitOrderDetail(orderId, detail);

    return detail;
  }

  async updateStatus(userId: string, orderId: string, status: "delivered" | "cancelled"): Promise<OrderSummary> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId: userId },
      include: { buyer: true, items: true },
    });

    if (!order) throw new NotFoundException("Pedido não encontrado");
    if (order.status !== "PENDING") {
      throw new BadRequestException("Este pedido já foi finalizado ou cancelado");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const orderUpdated = await tx.order.update({
        where: { id: orderId },
        data: { status: status === "delivered" ? "DELIVERED" : "CANCELLED" },
        include: {
          seller: true,
          buyer: true,
          items: true,
        },
      });

      if (status === "delivered") {
        // Find folder and items to reduce inventory
        const folder = await tx.collectionFolder.findFirst({
          where: {
            OR: [
              { id: order.proposalId ? (await tx.collectionCartOffer.findUnique({ where: { id: order.proposalId } }))?.folderId : undefined },
              { items: { some: { collectionItem: { auctions: { some: { id: order.auctionId || undefined } } } } } }
            ]
          }
        });

        if (folder) {
          for (const item of order.items) {
            // Find the collection item owned by the seller
            // We need to match by card name, condition, variant as the order items are snapshots
            const collectionItem = await tx.collectionItem.findFirst({
              where: {
                userId,
                card: { name: item.name },
                condition: item.condition as any,
                variant: item.variant ?? undefined,
              }
            });

            if (collectionItem) {
              const newQuantity = Math.max(0, collectionItem.quantity - item.quantity);
              if (newQuantity === 0) {
                await tx.collectionItem.delete({ where: { id: collectionItem.id } });
              } else {
                await tx.collectionItem.update({
                  where: { id: collectionItem.id },
                  data: { quantity: newQuantity }
                });
              }
            }
          }
        }
      }

      return orderUpdated;
    });

    // Send email notification to buyer
    void this.emailService.sendOrderStatusEmail(
      order.buyer.email,
      orderId,
      status
    ).catch(err => console.error("Failed to send order status email", err));

    const summary = this.mapOrder(updated);

    const detail = await this.getOrder(userId, orderId);
    this.realtime.emitOrderDetail(orderId, detail);

    return summary;
  }

  private mapOrder(o: any): OrderSummary {
    return {
      id: o.id,
      sellerId: o.sellerId,
      sellerName: o.seller.name || o.seller.email,
      sellerWhatsapp: o.seller.whatsapp,
      buyerId: o.buyerId,
      buyerName: o.buyer.name || o.buyer.email,
      buyerWhatsapp: o.buyer.whatsapp,
      status: o.status.toLowerCase() as OrderStatus,
      totalAmount: Number(o.totalAmountBrl),
      auctionId: o.auctionId,
      proposalId: o.proposalId,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      items: o.items.map((i: any) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        price: Number(i.priceBrl),
        imageSmall: i.imageSmall,
        condition: i.condition,
        variant: i.variant,
        cardNumber: i.cardNumber,
        cardTotal: i.cardTotal,
      })),
    };
  }

  private mapOrderDetail(o: any): OrderDetail {
    return {
      ...this.mapOrder(o),
      messages: (o.messages ?? []).map((message: any): OrderMessage => ({
        id: message.id,
        orderId: message.orderId,
        senderId: message.senderId,
        senderName: message.sender?.name || message.sender?.email || "Usuário",
        message: message.message,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
}
