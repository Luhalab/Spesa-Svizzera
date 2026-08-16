// -----------------------------------------------------------------------
// Wrapper attorno a @nicktcode/swissgroceries-mcp (github.com/nicktcode/swissgroceries-mcp)
//
// swissgroceries-mcp è un server MCP: viene avviato come sotto-processo e
// interrogato via protocollo MCP.
//
// IMPORTANTE: il pacchetto è elencato come DIPENDENZA NORMALE in package.json
// (non scaricato al volo con "npx -y" ad ogni richiesta). Questo è necessario
// perché le funzioni serverless di Vercel hanno il filesystem in sola
// lettura a runtime: "npx -y" fallirebbe sempre, perché non può scrivere la
// cache del pacchetto scaricato. Installandolo come dipendenza normale,
// Vercel lo scarica durante il BUILD (quella fase può scrivere su disco), e
// a runtime lo eseguiamo già pronto — senza bisogno di scaricare nulla.
//
// Resta comunque più lento di un backend sempre acceso, perché ogni
// richiesta avvia comunque un nuovo processo Node da zero (niente
// download, ma l'avvio del processo e la connessione MCP hanno un costo).
// -----------------------------------------------------------------------

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let clientPromise = null;

async function getClient() {
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const transport = new StdioClientTransport({
      // Niente "-y": il pacchetto è già installato in node_modules dal build,
      // quindi npx lo trova in locale e non tenta nessun accesso di rete/scrittura.
      command: "npx",
      args: ["@nicktcode/swissgroceries-mcp"],
      env: {
        ...process.env,
        // Rete di sicurezza: se npx provasse comunque a scrivere qualcosa
        // (es. un file di config), che lo faccia nell'unica cartella
        // scrivibile disponibile in una funzione Vercel.
        HOME: "/tmp",
        npm_config_cache: "/tmp/.npm-cache",
      },
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
