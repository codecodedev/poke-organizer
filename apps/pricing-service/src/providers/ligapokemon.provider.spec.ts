import { describe, expect, it } from "vitest";
import type { PriceLookupKey } from "@poke-organizer/shared";
import { buildLigaPokemonCardUrl, LigaPokemonProvider, parseLigaPokemonMarketplacePrice } from "./ligapokemon.provider";

const key: PriceLookupKey = {
  itemId: "item-1",
  card: {
    externalId: "me2pt5-46",
    name: "Snorunt",
    number: "46",
    printedTotal: 217,
    setId: "me2pt5",
    setName: "Ascended Heroes"
  },
  variant: "reverseHolofoil",
  language: "en",
  condition: "NM"
};

const marketplaceHtml = `
  <section>
    <h3>Preco Medio de Venda no Marketplace</h3>
    <table>
      <tr>
        <td><span>N</span> Normal</td>
        <td>R$ 0,16</td>
        <td>R$ 0,60</td>
        <td>R$ 9,00</td>
      </tr>
      <tr>
        <td><span>RF</span> Reverse Foil</td>
        <td>R$ 0,69</td>
        <td>R$ 2,66</td>
        <td>R$ 3,99</td>
      </tr>
    </table>
  </section>
`;

describe("LigaPokemonProvider", () => {
  it("builds the card URL using LigaPokemon padded numbering", () => {
    expect(buildLigaPokemonCardUrl(key)).toBe(
      "https://www.ligapokemon.com.br/?view=cards%2Fcard&tipo=1&card=Snorunt+%28046%2F217%29"
    );
  });

  it("parses the first BRL value from the matching marketplace variant row", () => {
    expect(parseLigaPokemonMarketplacePrice(marketplaceHtml, "normal")).toEqual({
      variantLabel: "Normal",
      amountBrl: 0.16
    });
    expect(parseLigaPokemonMarketplacePrice(marketplaceHtml, "reverseHolofoil")).toEqual({
      variantLabel: "Reverse Foil",
      amountBrl: 0.69
    });
  });

  it("returns null when Cloudflare intercepts the request", async () => {
    const provider = new LigaPokemonProvider(async () =>
      new Response("<title>Just a moment...</title><script src=\"/cdn-cgi/challenge-platform/test\"></script>", {
        status: 403,
        headers: { "cf-mitigated": "challenge" }
      })
    );

    await expect(provider.findLowestListing(key)).resolves.toBeNull();
  });
});
