// -----------------------------------------------------------------------
// Backend sempre acceso per Spesa Svizzera.
//
// A differenza delle funzioni serverless di Vercel, questo processo Node
// resta avviato in continuazione: il server MCP (swissgroceries-mcp) viene
// connesso UNA SOLA VOLTA all'avvio e riusato per tutte le richieste
// successive — niente più cold-start, niente più timeout.
//
// Pensato per essere deployato su Railway o Render (piano gratuito).
// -----------------------------------------------------------------------

import express from "express";
import cors from "cors";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const app = express();
const PORT = process.env.PORT || 3001;

// In produzione imposta FRONTEND_ORIGIN sull'URL esatto della tua app Vercel
// (es. https://spesa-svizzera.vercel.app) per limitare chi può chiamare questa API.
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
app.use(cors({ origin: FRONTEND_ORIGIN }));

// --- Connessione a swissgroceries-mcp, tenuta viva per tutta la vita del processo ---

let client = null;
let connecting = null;

async function getClient() {
  if (client) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    console.log("Avvio swissgroceries-mcp…");
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@nicktcode/swissgroceries-mcp"],
    });
    const c = new Client({ name: "spesa-svizzera-backend", version: "0.1.0" }, { capabilities: {} });
    await c.connect(transport);
    console.log("swissgroceries-mcp connesso.");
    client = c;
    connecting = null;
    return c;
  })();

  return connecting;
}

function parseToolResult(result) {
  const textBlock = result?.content?.find((b) => b.type === "text");
  if (!textBlock) return null;
  try {
    return JSON.parse(textBlock.text);
  } catch {
    return textBlock.text;
  }
}

// --- Endpoint di salute, usato da Railway/Render per sapere se il server è vivo ---
app.get("/health", (req, res) => res.json({ status: "ok" }));

// --- Ricerca prodotti cross-catena ---
app.get("/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Parametro 'q' mancante" });

  try {
    const c = await getClient();
    const result = await c.callTool({ name: "search_products", arguments: { query: q } });
    const parsed = parseToolResult(result);
    res.json({ source: "live", results: parsed });
  } catch (err) {
    console.error("Errore ricerca:", err);
    res.status(502).json({ error: "swissgroceries-mcp non raggiungibile", detail: err.message });
  }
});

// --- Negozi vicini per catena (in alternativa a Overpass, se preferisci un'unica fonte) ---
app.get("/stores", async (req, res) => {
  const { postalCode, lat, lng, chain, radiusKm = 5 } = req.query;
  try {
    const c = await getClient();
    const args = postalCode
      ? { postalCode, chain, radiusKm: Number(radiusKm) }
      : { lat: Number(lat), lng: Number(lng), chain, radiusKm: Number(radiusKm) };
    const result = await c.callTool({ name: "find_stores", arguments: args });
    res.json({ source: "live", stores: parseToolResult(result) });
  } catch (err) {
    console.error("Errore ricerca negozi:", err);
    res.status(502).json({ error: "swissgroceries-mcp non raggiungibile", detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Spesa Svizzera in ascolto sulla porta ${PORT}`);
  // Avvia subito la connessione MCP invece di aspettare la prima richiesta,
  // così la prima ricerca dell'utente non deve aspettare il bootstrap.
  getClient().catch((err) => console.error("Bootstrap MCP fallito:", err.message));
});
