import { searchProducts, getPromotions } from "../../lib/mcpClient";
import { findDemoProduct } from "../../lib/demoCatalog";

// Cerca più termini in una sola richiesta, riusando la stessa connessione a
// swissgroceries-mcp per tutti (invece di far ripartire il processo per
// ognuno) — molto più veloce di N chiamate separate a /api/search.
export const config = {
  maxDuration: 60,
};

const TARGET_CHAINS = ["migros", "coop"];

function cheapestForChain(byChain, chainId) {
  const list = Array.isArray(byChain?.[chainId]) ? byChain[chainId] : [];
  if (list.length === 0) return null;
  return list.reduce((a, b) => {
    const pa = a?.price?.current ?? Infinity;
    const pb = b?.price?.current ?? Infinity;
    return pb < pa ? b : a;
  });
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
      const [byChainResult, promoResult] = await Promise.all([
        searchProducts(term),
        getPromotions({ keyword: term }).catch(() => null),
      ]);
      const byChain = byChainResult?.byChain;
      if (!byChain) throw new Error("Formato risposta inatteso");

      const prices = {};
      let name = term;
      let foundAny = false;
      TARGET_CHAINS.forEach((chainId) => {
        const cheapest = cheapestForChain(byChain, chainId);
        if (cheapest) {
          prices[chainId] = cheapest.price?.current ?? null;
          name = cheapest.name || name;
          foundAny = true;
        } else {
          prices[chainId] = null;
        }
      });

      if (!foundAny) {
        items.push({ term, name: term, prices: { migros: null, coop: null }, notFound: true });
      } else {
        const hasPromo = Array.isArray(promoResult) && promoResult.length > 0;
        items.push({ term, name, prices, hasPromo });
      }
    } catch (err) {
      console.error(`Ricerca live fallita per "${term}", uso demo:`, err.message);
      source = "demo";
      const demo = findDemoProduct(term);
      if (demo) {
        items.push({
          term,
          name: demo.name,
          prices: { migros: demo.prices.migros ?? null, coop: demo.prices.coop ?? null },
        });
      } else {
        items.push({ term, name: term, prices: { migros: null, coop: null }, notFound: true });
      }
    }
  }

  return res.status(200).json({ source, items });
}
