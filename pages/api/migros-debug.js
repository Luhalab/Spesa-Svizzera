// Endpoint temporaneo di debug: mostra esattamente cosa restituisce
// migros-mcp, senza nessuna pulizia/estrazione — per capire la struttura
// reale dei dati prima di rifinire l'estrazione in migrosMcpClient.js.
//
// Uso: /api/migros-debug?q=ceci

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export const config = {
  maxDuration: 60,
};

function parseToolResult(result) {
  const textBlock = result?.content?.find((c) => c.type === "text");
  if (!textBlock) return { raw: result };
  try {
    return JSON.parse(textBlock.text);
  } catch {
    return textBlock.text;
  }
}

export default async function handler(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Parametro 'q' mancante" });

  const detailCount = Math.min(parseInt(req.query.details) || 3, 10);

  const uniqueHome = `/tmp/mmcp-dbg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["migros-mcp"],
    env: { ...process.env, HOME: uniqueHome, npm_config_cache: `${uniqueHome}/.npm-cache` },
  });
  const client = new Client({ name: "spesa-svizzera-debug", version: "0.1.0" }, { capabilities: {} });

  try {
    await client.connect(transport);

    const searchRaw = await client.callTool({ name: "search_products", arguments: { query: q } });
    const searchResult = parseToolResult(searchRaw);

    // Prova a individuare degli id dai primi elementi, in qualunque forma
    // arrivino, solo per recuperare anche qualche dettaglio di esempio.
    const list = Array.isArray(searchResult?.productIds)
      ? searchResult.productIds
      : Array.isArray(searchResult)
      ? searchResult
      : Array.isArray(searchResult?.products)
      ? searchResult.products
      : Array.isArray(searchResult?.results)
      ? searchResult.results
      : [];
    const candidateIds = list
      .slice(0, detailCount)
      .map((item) => (typeof item === "string" || typeof item === "number" ? item : item?.id ?? item?.productId ?? item?.uid))
      .filter((id) => id != null);

    const details = [];
    for (const id of candidateIds) {
      try {
        const raw = await client.callTool({ name: "get_product_details", arguments: { id } });
        details.push({ id, result: parseToolResult(raw) });
      } catch (e) {
        details.push({ id, error: e.message });
      }
    }

    return res.status(200).json({
      query: q,
      searchResultRaw: searchResult,
      extractedIds: candidateIds,
      productDetails: details,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
