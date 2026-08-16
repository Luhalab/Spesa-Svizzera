import { searchProducts, getPromotions } from "../../lib/mcpClient";
import { findDemoProduct } from "../../lib/demoCatalog";

// Alziamo il tempo massimo consentito dalla funzione: avviare swissgroceries-mcp
// da zero ad ogni richiesta può richiedere diversi secondi. 60s è il massimo
// disponibile sul piano gratuito (Hobby) di Vercel.
export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "Parametro 'q' mancante" });
  }
  const term = q.trim();

  try {
    const [results, promotions] = await Promise.all([
      searchProducts(term),
      getPromotions({ keyword: term }).catch(() => null),
    ]);
    if (!results) throw new Error("Nessun risultato da swissgroceries-mcp");
    return res.status(200).json({ source: "live", results, promotions });
  } catch (err) {
    // Fallback: dati demo, così l'app resta utilizzabile anche se
    // l'avvio di swissgroceries-mcp fallisce o va in timeout.
    console.error("swissgroceries-mcp non disponibile, uso i dati demo:", err.message);
    const match = findDemoProduct(term);
    return res.status(200).json({
      source: "demo",
      results: match ? [match] : [],
      warning: "Dati demo: la ricerca live non ha risposto in tempo.",
      debug: err.message,
    });
  }
}
