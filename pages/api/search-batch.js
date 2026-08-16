import { searchProducts, getPromotions } from "../../lib/mcpClient";
import { findDemoProduct } from "../../lib/demoCatalog";

// Cerca più termini in una sola richiesta, riusando la stessa connessione a
// swissgroceries-mcp per tutti. Invece di scegliere automaticamente il
// risultato più economico (rischioso: può prendere un prodotto sbagliato),
// restituisce fino a 5 candidati per catena, così l'utente sceglie a mano.
export const config = {
  maxDuration: 60,
};

const TARGET_CHAINS = ["migros", "coop"];

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
  const terms = Array.isArray(req.body?.terms) ? req.body.terms : [];
  if (terms.length === 0) {
    return res.status(400).json({ error: "Nessun termine da cercare" });
  }

  const items = [];
  let source = "live";

  for (const rawTerm of terms) {
    const term = String(rawTerm).trim();
    if (!term) continue;

    try {
      const byChainResult = await searchProducts(term);
      const byChain = byChainResult?.byChain;
      if (!byChain) throw new Error("Formato risposta inatteso");

      const candidates = {};
      const rawCounts = {};
      TARGET_CHAINS.forEach((chainId) => {
        const rawList = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
        rawCounts[chainId] = rawList.length;
        candidates[chainId] = candidatesForChain(byChain, chainId);
      });
      items.push({ term, candidates, rawCounts, raw: true });
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
