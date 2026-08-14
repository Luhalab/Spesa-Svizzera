import { searchProducts } from "../../lib/mcpClient";
import { DEMO_CATALOG } from "../../lib/demoCatalog";

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: "Parametro 'q' mancante" });
  }

  try {
    const results = await searchProducts(q.trim());
    if (!results) throw new Error("Nessun risultato da swissgroceries-mcp");
    return res.status(200).json({ source: "live", results });
  } catch (err) {
    // Fallback: dati demo, così l'app resta utilizzabile anche se
    // l'integrazione MCP non è ancora configurata o è irraggiungibile.
    console.error("swissgroceries-mcp non disponibile, uso i dati demo:", err.message);
    const match = DEMO_CATALOG.find((p) =>
      p.name.toLowerCase().includes(q.trim().toLowerCase())
    );
    return res.status(200).json({
      source: "demo",
      results: match ? [match] : [],
      warning: "Dati demo: configura swissgroceries-mcp per i prezzi reali (vedi README).",
    });
  }
}
