import { searchProducts, getPromotions } from "../../lib/mcpClient";
import { searchMigrosPilot } from "../../lib/migrosMcpClient";
import { findDemoProduct } from "../../lib/demoCatalog";

// Cerca più termini in una sola richiesta. Migros passa dal pilota
// migros-mcp (endpoint dedicato, più preciso); Coop/Denner/Otto's restano
// su swissgroceries-mcp come prima.
export const config = {
  maxDuration: 60,
};

const SGM_CHAINS = ["coop", "denner", "ottos"]; // via swissgroceries-mcp
const ALL_CHAINS = ["migros", ...SGM_CHAINS];

// Una sola richiesta pulita per termine, senza retry immediati: due
// richieste ravvicinate hanno il profilo tipico di un bot agli occhi della
// protezione anti-bot di Coop (DataDome) e possono peggiorare il blocco
// invece di aggirarlo. Meglio una richiesta sola, senza fretta.
//
// Restituisce sia byChain sia errors: il pacchetto segnala esplicitamente
// quando una catena fallisce (es. Coop → "HTTP 403: Access Forbidden"),
// il problema era solo che il codice prima ignorava questo campo.
async function searchOnce(term) {
  const result = await searchProducts(term);
  return { byChain: result?.byChain || {}, errors: Array.isArray(result?.errors) ? result.errors : [] };
}

function formatSize(size) {
  if (size?.value && size?.unit) return `${size.value}${size.unit}`;
  return null;
}

function candidatesForChain(byChain, chainId) {
  const list = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
  const seen = new Set();
  const cleaned = [];

  list.forEach((p) => {
    const price = p?.price?.current ?? p?.price?.value ?? null;
    // Scarta prezzi mancanti o a zero: quasi certamente un dato mal
    // formattato nella risposta grezza, non un prodotto gratis.
    if (price == null || price <= 0 || !p?.name) return;
    const size = formatSize(p?.size);
    const key = `${p.name}|${p.brand || ""}|${price}|${size || ""}`;
    if (seen.has(key)) return; // niente doppioni identici
    seen.add(key);

    // "tags" normalizzato (quando presente) porta indicazioni dietetiche
    // reali: vegan, vegetarian, gluten-free, organic, budget, ecc. Per Coop
    // ci sono anche booleani più precisi nei dati grezzi specifici.
    const tags = new Set(Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : []);
    if (p?.raw?.vegan) tags.add("vegan");
    if (p?.raw?.vegetarian) tags.add("vegetarian");
    if (p?.raw?.glutenFree) tags.add("gluten-free");

    const rating = p?.raw?.averageRating ?? p?.raw?.rating ?? null;
    const numberOfRatings = p?.raw?.numberOfRatings ?? null;

    // Prezzo al kg/litro: permette di confrontare formati diversi alla pari.
    const unitPrice =
      p?.unitPrice?.value != null && p?.unitPrice?.per
        ? { value: p.unitPrice.value, per: p.unitPrice.per }
        : null;

    // Multipack: se il prezzo mostrato è per una confezione con più pezzi,
    // questo evita l'errore già fatto una volta (pacco da 6 scambiato per
    // pacco singolo).
    const multipack = p?.multipack
      ? {
          count: p.multipack.count,
          perUnitPrice: p.multipack.perUnitPrice ?? null,
          perUnitSize: formatSize(p.multipack.perUnitSize),
        }
      : null;

    // Prezzo pieno, quando il prodotto è in sconto.
    const regularPrice =
      p?.price?.regular != null && p.price.regular > price ? p.price.regular : null;

    // Data di scadenza della promozione, quando presente (es. Denner).
    const promoEndsAt = p?.promotion?.endsAt || null;

    cleaned.push({
      name: p.name,
      price,
      brand: p.brand || null,
      size,
      tags: [...tags],
      rating,
      numberOfRatings,
      imageUrl: p.imageUrl || null,
      unitPrice,
      multipack,
      regularPrice,
      promoEndsAt,
    });
  });

  cleaned.sort((a, b) => a.price - b.price);
  return cleaned; // nessun limite: tutti i risultati puliti, ordinati per prezzo
}

export default async function handler(req, res) {
  const terms =
    req.method === "GET"
      ? [String(req.query.q || "")]
      : Array.isArray(req.body?.terms)
      ? req.body.terms
      : [];
  if (terms.length === 0 || !terms[0]) {
    return res.status(400).json({ error: "Nessun termine da cercare" });
  }

  const items = [];
  let source = "live";

  for (let i = 0; i < terms.length; i++) {
    const term = String(terms[i]).trim();
    if (!term) continue;

    // Pausa tra un prodotto e l'altro (non prima del primo): richieste
    // ravvicinate hanno un profilo "da bot" agli occhi della protezione
    // anti-bot di Coop, molto più di richieste isolate e distanziate.
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));

    try {
      const { byChain, errors } = await searchOnce(term);
      if (!byChain) throw new Error("Formato risposta inatteso");

      const candidates = {};
      const rawCounts = {};
      const chainErrors = {};

      // Coop / Denner / Otto's: come prima, via swissgroceries-mcp.
      SGM_CHAINS.forEach((chainId) => {
        const rawList = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
        rawCounts[chainId] = rawList.length;
        candidates[chainId] = candidatesForChain(byChain, chainId);
        const err = errors.find((e) => e.chain === chainId);
        if (err) chainErrors[chainId] = err.reason || err.code || "errore sconosciuto";
      });

      // Migros: pilota migros-mcp, con fallback su swissgroceries-mcp se il
      // pilota fallisce (es. pacchetto irraggiungibile) — così Migros non
      // sparisce del tutto per un problema tecnico del pilota.
      try {
        const { candidates: migrosCandidates, rawSearchResult } = await searchMigrosPilot(term);
        candidates.migros = migrosCandidates;
        rawCounts.migros =
          rawSearchResult?.numberOfProducts ??
          rawSearchResult?.productIds?.length ??
          migrosCandidates.length;
      } catch (migrosErr) {
        console.error(`Pilota Migros fallito per "${term}", uso swissgroceries-mcp:`, migrosErr.message);
        const rawList = Array.isArray(byChain?.migros) ? byChain.migros : [];
        rawCounts.migros = rawList.length;
        candidates.migros = candidatesForChain(byChain, "migros");
        chainErrors.migros = `pilota non disponibile, dati di riserva: ${migrosErr.message}`;
      }

      items.push({ term, candidates, rawCounts, chainErrors, raw: true });
    } catch (err) {
      console.error(`Ricerca live fallita per "${term}", uso demo:`, err.message);
      source = "demo";
      const demo = findDemoProduct(term);
      const candidates = { migros: [], coop: [] };
      if (demo) {
        if (demo.prices.migros != null) candidates.migros = [{ name: demo.name, price: demo.prices.migros, brand: null }];
        if (demo.prices.coop != null) candidates.coop = [{ name: demo.name, price: demo.prices.coop, brand: null }];
      }
      items.push({ term, candidates, raw: false });
    }
  }

  return res.status(200).json({ source, items });
}
