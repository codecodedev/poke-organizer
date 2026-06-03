import { Injectable } from "@nestjs/common";
import {
  RecognitionCandidate,
  formatCardNumber,
  normalizeCardNumber,
  normalizeCardNumberForSearch,
  normalizeSearchText,
  parseOcrCardNumber,
  parseOcrNameHint
} from "@poke-organizer/shared";
import { CatalogService } from "../cards/catalog.service";
import { RecognitionCandidatesDto } from "./dto";

@Injectable()
export class RecognitionService {
  constructor(private readonly catalog: CatalogService) {}

  async findCandidates(dto: RecognitionCandidatesDto): Promise<RecognitionCandidate[]> {
    const number = dto.numberHint ?? parseOcrCardNumber(dto.text) ?? undefined;
    const name = dto.nameHint ?? parseOcrNameHint(dto.text) ?? dto.text.split(/\s+/).slice(0, 4).join(" ");

    const cards = await this.catalog.search({
      query: name,
      number
    });

    const normalizedName = normalizeSearchText(name);
    const normalizedNumber = number ? normalizeCardNumber(number) : null;

    return cards
      .map((card) => {
        let score = 0;
        const reasons: string[] = [];

        const completeCardNumber = normalizeCardNumber(formatCardNumber(card.number, card.printedTotal));
        if (normalizedNumber && completeCardNumber === normalizedNumber) {
          score += 60;
          reasons.push("numero igual ao OCR");
        } else if (normalizedNumber && normalizeCardNumberForSearch(card.number) === normalizeCardNumberForSearch(normalizedNumber)) {
          score += 35;
          reasons.push("numero base igual ao OCR");
        }

        const cardName = normalizeSearchText(card.name);
        if (cardName === normalizedName) {
          score += 35;
          reasons.push("nome igual ao OCR");
        } else if (cardName.includes(normalizedName) || normalizedName.includes(cardName)) {
          score += 20;
          reasons.push("nome parecido com OCR");
        }

        if (card.imageSmall || card.imageLarge) {
          score += 5;
        }

        return {
          card,
          score,
          reason: reasons.join(", ") || "candidato por busca textual"
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }
}
