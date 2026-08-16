import { searchProducts, getPromotions } from "../../lib/mcpClient";
import { findDemoProduct } from "../../lib/demoCatalog";

// Cerca più termini in una sola richiesta, riusando la stessa connessione a
// swissgroceries-mcp per tutti. Invece di scegliere automaticamente il
// risultato più economico (rischioso: può prendere un prodotto sbagliato),
// restituisce fino a 5 candidati per catena, così l'utente sceglie a mano.
export const config = {
  maxDuration: 60,
};

const TARGET_CHAINS = ["migros", "coop", "denner", "ottos"];

// Una sola richiesta pulita per termine, senza retry immediati: due
// richieste ravvicinate hanno il profilo tipico di un bot agli occhi della
// protezione anti-bot di Coop (DataDome) e possono peggiorare il blocco
// invece di aggirarlo. Meglio una richiesta sola, senza fretta.
async function searchOnce(term) {
  return (await searchProducts(term))?.byChain || {};
}

function candidatesForChain(byChain, chainId, limit = 8) {
  const list = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
  const seen = new Set();
  const cleaned = [];

  list.forEach((p) => {
    const price = p?.price?.current ?? p?.price?.value ?? null;
    // Scarta prezzi mancanti o a zero: quasi certamente un dato mal
    // formattato nella risposta grezza, non un prodotto gratis.
    if (price == null || price <= 0 || !p?.name) return;
    const key = `${p.name}|${p.brand || ""}|${price}`;
    if (seen.has(key)) return; // niente doppioni identici
    seen.add(key);
    cleaned.push({ name: p.name, price, brand: p.brand || null });
  });

  cleaned.sort((a, b) => a.price - b.price);
  return cleaned.slice(0, limit);
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
      const byChain = await searchOnce(term);
      if (!byChain) throw new Error("Formato risposta inatteso");

      const candidates = {};
      const rawCounts = {};
      TARGET_CHAINS.forEach((chainId) => {
        const rawList = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
        rawCounts[chainId] = rawList.length;
        candidates[chainId] = candidatesForChain(byChain, chainId);
      });
      // Debug temporaneo: le chiavi presenti nella risposta grezza e un
      // campione del primo elemento Coop (se c'è), per vedere la verità
      // invece di continuare a ipotizzare.
      const debug = {
        byChainKeys: Object.keys(byChain || {}),
        coopRawSample: Array.isArray(byChain?.coop) ? byChain.coop.slice(0, 1) : byChain?.coop,
      };
      items.push({ term, candidates, rawCounts, debug, raw: true });
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
