// -----------------------------------------------------------------------
// Wrapper attorno a @nicktcode/swissgroceries-mcp (github.com/nicktcode/swissgroceries-mcp)
//
// swissgroceries-mcp è un server MCP: viene avviato come sotto-processo con
// `npx -y @nicktcode/swissgroceries-mcp` e interrogato via protocollo MCP.
//
// SCELTA FATTA QUI: nessun backend separato. Ogni chiamata a queste funzioni,
// se eseguita da una funzione serverless di Vercel, riavvia il sotto-processo
// da zero (npx deve verificare/scaricare il pacchetto). Questo rende le
// richieste più lente — spesso qualche secondo, a volte di più al "cold
// start" — ma evita di dover gestire un servizio sempre acceso altrove.
//
// Se in futuro servisse più velocità o affidabilità, la cartella backend/
// contiene un'alternativa con processo persistente (Render/Railway).
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
export async function searchProducts(query) {
  const client = await getClient();
  const result = await client.callTool({
    name: "search_products",
    arguments: { query },
  });
  return parseToolResult(result);
}

// Promozioni/sconti attivi, filtrabili per parola chiave o catena.
export async function getPromotions({ keyword, chain } = {}) {
  const client = await getClient();
  const result = await client.callTool({
    name: "get_promotions",
    arguments: { keyword, chain },
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
