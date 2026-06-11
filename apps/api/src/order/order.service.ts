import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrderSummary, OrderStatus } from "@poke-organizer/shared";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
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

    return this.mapOrder(updated);
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
}
