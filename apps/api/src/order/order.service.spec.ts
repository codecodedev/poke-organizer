import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderService } from "./order.service";

describe("OrderService", () => {
  let prisma: any;
  let emailService: any;
  let realtime: any;
  let service: OrderService;

  const now = new Date("2026-06-11T12:00:00.000Z");
  const seller = { id: "seller-1", name: "Vendedor", email: "seller@example.com" };
  const buyer = { id: "buyer-1", name: "Comprador", email: "buyer@example.com" };
  const baseOrder = {
    id: "order-abcdef",
    sellerId: seller.id,
    seller,
    buyerId: buyer.id,
    buyer,
    status: "PENDING",
    totalAmountBrl: 120,
    auctionId: null,
    proposalId: null,
    createdAt: now,
    updatedAt: now,
    items: [],
  };

  beforeEach(() => {
    prisma = {
      order: {
        findFirst: vi.fn(),
      },
      orderMessage: {
        create: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
    };
    emailService = {
      sendOrderMessageEmail: vi.fn().mockResolvedValue(undefined),
      sendOrderStatusEmail: vi.fn().mockResolvedValue(undefined),
    };
    realtime = {
      emitOrderDetail: vi.fn(),
    };
    service = new OrderService(prisma, emailService, realtime);
  });

  it("notifica o destinatário quando a primeira mensagem do pedido é enviada", async () => {
    prisma.order.findFirst
      .mockResolvedValueOnce({ ...baseOrder, messages: [] })
      .mockResolvedValueOnce({
        ...baseOrder,
        messages: [
          {
            id: "message-1",
            orderId: baseOrder.id,
            senderId: seller.id,
            sender: seller,
            message: "Podemos negociar o frete?",
            createdAt: now,
          },
        ],
      });
    prisma.orderMessage.create.mockResolvedValue({ id: "message-1" });

    const result = await service.createMessage(seller.id, baseOrder.id, " Podemos negociar o frete? ");

    expect(prisma.orderMessage.create).toHaveBeenCalledWith({
      data: {
        orderId: baseOrder.id,
        senderId: seller.id,
        message: "Podemos negociar o frete?",
      },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: buyer.id,
        title: "Nova mensagem no pedido",
        message: "Vendedor enviou uma mensagem sobre o pedido #ABCDEF.",
        link: `/?page=orders&order=${baseOrder.id}`,
      },
    });
    expect(emailService.sendOrderMessageEmail).toHaveBeenCalledWith(
      buyer.email,
      baseOrder.id,
      seller.name,
    );
    expect(realtime.emitOrderDetail).toHaveBeenCalledWith(baseOrder.id, result);
    expect(result.messages).toHaveLength(1);
  });

  it("não reenviará e-mail quando o pedido já tem conversa iniciada", async () => {
    prisma.order.findFirst
      .mockResolvedValueOnce({
        ...baseOrder,
        messages: [{ id: "message-1" }],
      })
      .mockResolvedValueOnce({
        ...baseOrder,
        messages: [
          {
            id: "message-2",
            orderId: baseOrder.id,
            senderId: buyer.id,
            sender: buyer,
            message: "Fechado.",
            createdAt: now,
          },
        ],
      });
    prisma.orderMessage.create.mockResolvedValue({ id: "message-2" });

    await service.createMessage(buyer.id, baseOrder.id, "Fechado.");

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(emailService.sendOrderMessageEmail).not.toHaveBeenCalled();
    expect(realtime.emitOrderDetail).toHaveBeenCalledTimes(1);
  });

  it("rejeita mensagem vazia", async () => {
    await expect(service.createMessage(seller.id, baseOrder.id, "   "))
      .rejects.toThrow(new BadRequestException("Mensagem é obrigatória"));

    expect(prisma.order.findFirst).not.toHaveBeenCalled();
    expect(prisma.orderMessage.create).not.toHaveBeenCalled();
  });
});
