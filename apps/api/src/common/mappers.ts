import { CardCondition as PrismaCardCondition, CardLanguage as PrismaCardLanguage } from "@prisma/client";
import { CardCondition, CardLanguage, CardSummary, normalizeSearchText } from "@poke-organizer/shared";

export function toPrismaLanguage(language?: CardLanguage): PrismaCardLanguage {
  if (language === "pt-BR") return PrismaCardLanguage.PT_BR;
  if (language === "en") return PrismaCardLanguage.EN;
  if (language === "ja") return PrismaCardLanguage.JA;
  return PrismaCardLanguage.UNKNOWN;
}

export function fromPrismaLanguage(language: PrismaCardLanguage): CardLanguage {
  if (language === PrismaCardLanguage.PT_BR) return "pt-BR";
  if (language === PrismaCardLanguage.EN) return "en";
  if (language === PrismaCardLanguage.JA) return "ja";
  return "unknown";
}

export function toPrismaCondition(condition?: CardCondition): PrismaCardCondition {
  return condition ? PrismaCardCondition[condition] : PrismaCardCondition.NM;
}

export function toCardSummary(card: {
  id: string;
  externalId: string;
  name: string;
  number: string;
  printedTotal: number | null;
  setTotal: number | null;
  setId: string | null;
  setCode: string | null;
  setName: string | null;
  rarity: string | null;
  artist: string | null;
  releaseDate: string | null;
  nationalPokedexNumbers: number[];
  types: string[];
  regulationMark: string | null;
  variants: string[];
  language: PrismaCardLanguage;
  imageSmall: string | null;
  imageLarge: string | null;
}): CardSummary {
  return {
    id: card.id,
    externalId: card.externalId,
    name: card.name,
    number: card.number,
    printedTotal: card.printedTotal,
    setTotal: card.setTotal,
    setId: card.setId,
    setCode: card.setCode,
    setName: card.setName,
    rarity: card.rarity,
    artist: card.artist,
    releaseDate: card.releaseDate,
    nationalPokedexNumbers: card.nationalPokedexNumbers,
    types: card.types,
    regulationMark: card.regulationMark,
    variants: card.variants,
    language: fromPrismaLanguage(card.language),
    imageSmall: card.imageSmall,
    imageLarge: card.imageLarge
  };
}

export function normalizeCardNameForDb(name: string): string {
  return normalizeSearchText(name);
}
