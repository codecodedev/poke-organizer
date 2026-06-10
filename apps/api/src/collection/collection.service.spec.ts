import { describe, expect, it, vi, beforeEach } from "vitest";
import { CollectionService } from "./collection.service";
import { BadRequestException } from "@nestjs/common";

describe("CollectionService", () => {
  let service: CollectionService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      collectionFolder: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
      },
      collectionItem: {
        deleteMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    service = new CollectionService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe("createFolder", () => {
    it("should throw BadRequestException if folder name already exists for user", async () => {
      prisma.collectionFolder.findUnique.mockResolvedValue({ id: "folder-1", name: "asda" });

      await expect(
        service.createFolder("user-1", { name: "asda", isStore: false }),
      ).rejects.toThrow(new BadRequestException("Você já possui uma coleção com este nome"));

      expect(prisma.collectionFolder.findUnique).toHaveBeenCalledWith({
        where: { userId_name: { userId: "user-1", name: "asda" } },
      });
      expect(prisma.collectionFolder.create).not.toHaveBeenCalled();
    });

    it("should create folder if name is unique", async () => {
      prisma.collectionFolder.findUnique.mockResolvedValue(null);
      prisma.collectionFolder.create.mockResolvedValue({
        id: "folder-2",
        name: "new-folder",
        userId: "user-1",
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createFolder("user-1", { name: "new-folder" });

      expect(result.name).toBe("new-folder");
      expect(prisma.collectionFolder.create).toHaveBeenCalled();
    });
  });

  describe("updateFolder", () => {
    it("should throw BadRequestException if new name already exists for user (and is not the same folder)", async () => {
      prisma.collectionFolder.findFirst.mockResolvedValue({ id: "folder-1", userId: "user-1" });
      prisma.collectionFolder.findUnique.mockResolvedValue({ id: "folder-2", name: "already-exists" });

      await expect(
        service.updateFolder("user-1", "folder-1", { name: "already-exists" }),
      ).rejects.toThrow(new BadRequestException("Você já possui uma coleção com este nome"));

      expect(prisma.collectionFolder.update).not.toHaveBeenCalled();
    });

    it("should allow update if name is the same as current folder", async () => {
      prisma.collectionFolder.findFirst.mockResolvedValue({ id: "folder-1", userId: "user-1" });
      prisma.collectionFolder.findUnique.mockResolvedValue({ id: "folder-1", name: "same-name" });
      prisma.collectionFolder.update.mockResolvedValue({ id: "folder-1", name: "same-name" });
      
      // Mocking getFolder which is called at the end of updateFolder
      vi.spyOn(service, "getFolder").mockResolvedValue({
        id: "folder-1",
        name: "same-name",
      } as any);

      const result = await service.updateFolder("user-1", "folder-1", { name: "same-name" });

      expect(result.name).toBe("same-name");
      expect(prisma.collectionFolder.update).toHaveBeenCalledWith({
        where: { id: "folder-1" },
        data: { name: "same-name" },
      });
    });
  });
});
