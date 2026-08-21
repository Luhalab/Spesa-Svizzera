// -----------------------------------------------------------------------
// PILOTA: client dedicato solo a Migros, usando il pacchetto migros-mcp
// (github.com/lewpgs/migros-mcp) invece di swissgroceries-mcp per questa
// catena. Motivo: la ricerca multi-catena di swissgroceries-mcp si è
// dimostrata inaffidabile anche su Migros (es. "ceci" → risultato di vino).
// migros-mcp è specializzato su una sola catena e usa gli stessi endpoint
// reali del sito (via migros-api-wrapper), quindi potenzialmente più preciso.
//
// Accesso anonimo, nessuna credenziale Migros richiesta (non tocchiamo
// carrello/ordini, solo ricerca prodotti).
//
// NOTA: search_products di questo pacchetto restituisce solo gli ID dei
// prodotti trovati — serve una chiamata separata (get_product_details) per
// ottenere nome/prezzo di ciascuno. Per contenere i tempi, prendiamo solo
// i primi N id e recuperiamo i dettagli in parallelo.
// -----------------------------------------------------------------------

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const uniqueHome = `/tmp/mmcp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["migros-mcp"],
      env: {
        ...process.env,
        HOME: uniqueHome,
        npm_config_cache: `${uniqueHome}/.npm-cache`,
      },
    });
    const client = new Client(
      { name: "spesa-svizzera-migros-pilot", version: "0.1.0" },
      { capabilities: {} }
    );
    await client.connect(transport);
    return client;
  })();

  return clientPromise;
}

function parseToolResult(result) {
  const textBlock = result?.content?.find((c) => c.type === "text");
  if (!textBlock) return null;
  try {
    return JSON.parse(textBlock.text);
  } catch {
    return textBlock.text;
  }
}

// Estrae in modo tollerante un id prodotto da forme diverse che il
// pacchetto potrebbe restituire (non abbiamo ancora visto lo schema esatto
// dal vivo, quindi copriamo più possibilità plausibili).
function extractIds(searchResult, limit) {
  const list = Array.isArray(searchResult?.productIds)
    ? searchResult.productIds
    : Array.isArray(searchResult)
    ? searchResult
    : Array.isArray(searchResult?.products)
    ? searchResult.products
    : Array.isArray(searchResult?.results)
    ? searchResult.results
    : [];
  return list
    .map((item) => (typeof item === "string" || typeof item === "number" ? item : item?.id ?? item?.productId ?? item?.uid))
    .filter((id) => id != null)
    .slice(0, limit);
}

// Estrae un numero da stringhe tipo "CHF 2.45" o "CHF 0.03/100ml".
function parseChf(str) {
  if (typeof str === "number") return str;
  if (typeof str !== "string") return null;
  const match = str.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

// "CHF 0.03/100ml" → { value: 0.03, per: "100ml" }
function parseUnitPrice(str) {
  if (typeof str !== "string") return null;
  const match = str.match(/CHF\s*([\d.]+)\s*\/\s*(\S+)/);
  if (!match) return null;
  return { value: parseFloat(match[1]), per: match[2] };
}

// Estrae in modo tollerante i campi che ci servono da un prodotto dettagliato.
// Schema confermato dal vivo (migros-mcp v0.2.x): name, brand (stringa),
// price come stringa "CHF X.XX", unitPrice come stringa "CHF X/unità",
// quantity come formato ("1kg", "6 x 1.5l"), ratings.average/count.
// Nessun campo immagine disponibile in questo pacchetto.
function normalizeProduct(p) {
  if (!p) return null;
  const name = p.name || p.title || p.productName || null;
  const price = parseChf(p.price) ?? (typeof p.price === "number" ? p.price : null);
  if (!name || price == null || price <= 0) return null;
  return {
    name,
    price,
    brand: typeof p.brand === "string" ? p.brand : p.brand?.name || null,
    size: p.quantity || p.size || null,
    imageUrl: null, // non disponibile in questo pacchetto
    rating: p.ratings?.average ?? p.rating ?? null,
    numberOfRatings: p.ratings?.count ?? null,
    unitPrice: parseUnitPrice(p.unitPrice),
    regularPrice: null, // non visto nello schema finora
  };
}

// Ricerca Migros pilota: restituisce candidati puliti nello stesso formato
// usato per le altre catene, oppure lancia un errore se qualcosa fallisce
// (il chiamante gestisce il fallback).
export async function searchMigrosPilot(term, { detailLimit = 10 } = {}) {
  const client = await getClient();
  const searchRaw = await client.callTool({ name: "search_products", arguments: { query: term } });
  const searchResult = parseToolResult(searchRaw);
  const ids = extractIds(searchResult, detailLimit);

  if (ids.length === 0) return { candidates: [], rawSearchResult: searchResult };

  // get_product_details accetta un array di id in un colpo solo (parametro
  // "productIds", plurale) — una sola chiamata invece di una per prodotto.
  const detailsRaw = await client.callTool({
    name: "get_product_details",
    arguments: { productIds: ids.map(String) },
  });
  const detailsResult = parseToolResult(detailsRaw);
  const detailsList = Array.isArray(detailsResult)
    ? detailsResult
    : Array.isArray(detailsResult?.products)
    ? detailsResult.products
    : Array.isArray(detailsResult?.results)
    ? detailsResult.results
    : [detailsResult];

  const candidates = detailsList.map(normalizeProduct).filter(Boolean).sort((a, b) => a.price - b.price);
  return { candidates, rawSearchResult: searchResult };
}
