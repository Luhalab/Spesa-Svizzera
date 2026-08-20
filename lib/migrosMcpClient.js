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
  const list = Array.isArray(searchResult)
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

// Estrae in modo tollerante i campi che ci servono da un prodotto dettagliato.
function normalizeProduct(p) {
  if (!p) return null;
  const name = p.name || p.title || p.productName || null;
  const priceRaw =
    p.price?.current ?? p.price?.value ?? p.price ?? p.offer?.price?.effectiveValue ?? null;
  const price = typeof priceRaw === "number" ? priceRaw : null;
  if (!name || price == null || price <= 0) return null;
  return {
    name,
    price,
    brand: p.brand?.name || p.brand || null,
    size: p.size || p.quantity || null,
    imageUrl: p.imageUrl || p.image || p.images?.[0]?.url || null,
    rating: p.rating || p.averageRating || null,
    unitPrice:
      p.unitPrice?.value != null && p.unitPrice?.per
        ? { value: p.unitPrice.value, per: p.unitPrice.per }
        : null,
    regularPrice: p.price?.regular != null && p.price.regular > price ? p.price.regular : null,
    _raw: p, // conservato per debug, rimosso prima di mandare al client se serve
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

  const details = await Promise.all(
    ids.map(async (id) => {
      try {
        const raw = await client.callTool({ name: "get_product_details", arguments: { id } });
        return normalizeProduct(parseToolResult(raw));
      } catch {
        return null;
      }
    })
  );

  const candidates = details.filter(Boolean).sort((a, b) => a.price - b.price);
  return { candidates, rawSearchResult: searchResult };
}
