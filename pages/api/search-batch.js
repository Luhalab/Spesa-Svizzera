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

function candidatesForChain(byChain, chainId, limit = 5) {
  const list = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
  return list
    .filter((p) => p?.price?.current != null && p?.name)
    .sort((a, b) => a.price.current - b.price.current)
    .slice(0, limit)
    .map((p) => ({ name: p.name, price: p.price.current, brand: p.brand || null }));
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
      TARGET_CHAINS.forEach((chainId) => {
        candidates[chainId] = candidatesForChain(byChain, chainId);
      });
      items.push({ term, candidates, raw: true });
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
