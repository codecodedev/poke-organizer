const UNIT_VALUES: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezesete: 17,
  dezessete: 17,
  dezassete: 17,
  dezoito: 18,
  dezenove: 19,
  dezanove: 19
};

const TENS_VALUES: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90
};

const HUNDREDS_VALUES: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900
};

export type SpokenCardNumber =
  | { mode: "specific"; number: number }
  | { mode: "general"; number: number; printedTotal: number };

export function parseSpecificSpokenNumber(transcript: string): number | null {
  return parseSpokenInteger(normalizeSpeechTokens(transcript));
}

export function parseGeneralSpokenCardNumber(
  transcript: string,
  options: { printedTotal?: number | null } = {},
): { number: number; printedTotal: number } | null {
  const normalizedText = normalizeSpeechText(transcript);
  const normalized = normalizedText.split(/\s+/).filter(Boolean);
  const preferredPrintedTotal =
    typeof options.printedTotal === "number" && Number.isFinite(options.printedTotal)
      ? options.printedTotal
      : null;
  const numericMatch = normalizedText.match(/\b(\d{1,4})\s*(?:\/|barra)\s*(\d{1,4})\b/);
  if (numericMatch) {
    return {
      number: Number.parseInt(numericMatch[1], 10),
      printedTotal: Number.parseInt(numericMatch[2], 10)
    };
  }

  const separatorIndex = normalized.findIndex((token) => token === "barra");
  if (separatorIndex === -1) {
    const numericPair = normalizedText.match(/\b(\d{1,4})\s+(\d{1,4})\b/);
    if (numericPair) {
      return {
        number: Number.parseInt(numericPair[1], 10),
        printedTotal: Number.parseInt(numericPair[2], 10)
      };
    }

    if (preferredPrintedTotal) {
      const totalText = String(preferredPrintedTotal);
      for (const token of normalized) {
        if (!/^\d{1,8}$/.test(token)) continue;

        if (token.length > totalText.length && token.endsWith(totalText)) {
          const number = Number.parseInt(token.slice(0, -totalText.length), 10);
          if (Number.isFinite(number)) {
            return { number, printedTotal: preferredPrintedTotal };
          }
        }

        const number = Number.parseInt(token, 10);
        if (Number.isFinite(number)) {
          return { number, printedTotal: preferredPrintedTotal };
        }
      }

      const number = parseSpokenInteger(normalized);
      if (number !== null) {
        return { number, printedTotal: preferredPrintedTotal };
      }
    }

    const digitTokens = normalized.filter((token) => /^\d{1,4}$/.test(token));
    if (digitTokens.length >= 2) {
      return {
        number: Number.parseInt(digitTokens[0], 10),
        printedTotal: Number.parseInt(digitTokens[1], 10)
      };
    }

    const compactDigits = normalized.find((token) => /^\d{4}$|^\d{6}$/.test(token));
    if (compactDigits) {
      const split = compactDigits.length / 2;
      return {
        number: Number.parseInt(compactDigits.slice(0, split), 10),
        printedTotal: Number.parseInt(compactDigits.slice(split), 10)
      };
    }

    return null;
  }

  const number = parseSpokenInteger(normalized.slice(0, separatorIndex));
  const printedTotal = parseSpokenInteger(normalized.slice(separatorIndex + 1));
  return number !== null && printedTotal !== null ? { number, printedTotal } : null;
}

function normalizeSpeechTokens(transcript: string): string[] {
  return normalizeSpeechText(transcript).split(/\s+/).filter(Boolean);
}

function normalizeSpeechText(transcript: string): string {
  return transcript
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\//g, " barra ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => (token === "bar" ? "barra" : token))
    .join(" ");
}

function parseSpokenInteger(tokens: string[]): number | null {
  if (!tokens.length) {
    return null;
  }

  const compactDigits = tokens.join("").match(/^\d{1,4}$/);
  if (compactDigits) {
    return Number.parseInt(compactDigits[0], 10);
  }

  const digitToken = tokens.find((token) => /^\d{1,4}$/.test(token));
  if (digitToken) {
    return Number.parseInt(digitToken, 10);
  }

  let total = 0;
  let found = false;

  for (const token of tokens) {
    if (token === "e" || token === "de" || token === "da" || token === "do") {
      continue;
    }

    const normalizedToken = normalizeNumberToken(token);
    const unitValue = UNIT_VALUES[normalizedToken];
    const tensValue = TENS_VALUES[normalizedToken];
    const hundredsValue = HUNDREDS_VALUES[normalizedToken];

    if (unitValue !== undefined) {
      total += unitValue;
      found = true;
      continue;
    }
    if (tensValue !== undefined) {
      total += tensValue;
      found = true;
      continue;
    }
    if (hundredsValue !== undefined) {
      total += hundredsValue;
      found = true;
    }
  }

  return found ? total : null;
}

function normalizeNumberToken(token: string): string {
  return token
    .replace(/^tr[eê]s$/, "tres")
    .replace(/^dez[ae]sete$/, "dezessete")
    .replace(/^cincoenta$/, "cinquenta");
}
