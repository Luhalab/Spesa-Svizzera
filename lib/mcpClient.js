// -----------------------------------------------------------------------
// Wrapper attorno a @nicktcode/swissgroceries-mcp (github.com/nicktcode/swissgroceries-mcp)
//
// swissgroceries-mcp è un server MCP (Model Context Protocol): non è una
// libreria "normale" da importare e chiamare come funzione, ma un processo
// a sé stante con cui si parla via protocollo MCP (stdio).
//
// Qui lo avviamo come sotto-processo con `npx -y @nicktcode/swissgroceries-mcp`
// e usiamo il Client ufficiale @modelcontextprotocol/sdk per chiamarne i tool:
//   - search_products  (ricerca cross-catena)
//   - find_stores       (negozi vicini a una posizione)
//   - plan_shopping     (pianificazione multi-negozio)
//
// ATTENZIONE — leggi il README prima di andare in produzione:
// avviare un sotto-processo ad ogni richiesta è pesante per le funzioni
// serverless di Vercel (cold start + npx download). Per un uso reale è
// consigliato un piccolo servizio Node sempre acceso (Railway, Render,
// Fly.io) invece delle funzioni serverless di Vercel per l'API backend,
// tenendo Vercel solo per il frontend Next.js.
// -----------------------------------------------------------------------

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@nicktcode/swissgroceries-mcp"],
    });

    const client = new Client(
      { name: "spesa-svizzera", version: "0.1.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    return client;
  })();

  return clientPromise;
}

// Cerca un prodotto su tutte le catene supportate.
// Restituisce un array normalizzato: [{ chain, name, price, unitPrice, promo }]
export async function searchProducts(query) {
  const client = await getClient();
  const result = await client.callTool({
    name: "search_products",
    arguments: { query },
  });
  return parseToolResult(result);
}

// Trova i negozi più vicini a una posizione (CAP svizzero o lat/lng).
export async function findStores({ postalCode, lat, lng, chain, radiusKm = 5 }) {
  const client = await getClient();
  const result = await client.callTool({
    name: "find_stores",
    arguments: postalCode ? { postalCode, chain, radiusKm } : { lat, lng, chain, radiusKm },
  });
  return parseToolResult(result);
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
