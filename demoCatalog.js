// Catalogo di fallback — usato solo se la chiamata reale a swissgroceries-mcp
// fallisce (es. in sviluppo locale senza rete, o come demo).
// In produzione i dati veri arrivano da lib/mcpClient.js

export const CHAINS = [
  { id: "migros", name: "Migros", color: "#FF6600" },
  { id: "coop", name: "Coop", color: "#E2001A" },
  { id: "denner", name: "Denner", color: "#0033A0" },
  { id: "aldi", name: "Aldi", color: "#00447C" },
];

export const DEMO_CATALOG = [
  { id: "latte", name: "Latte intero 1L", unit: "pz", prices: { migros: 1.55, coop: 1.6, denner: 1.35, aldi: 1.25 } },
  { id: "pane", name: "Pane bianco 500g", unit: "pz", prices: { migros: 2.4, coop: 2.5, denner: 2.1, aldi: 1.95 } },
  { id: "uova", name: "Uova (6 pz)", unit: "conf", prices: { migros: 3.9, coop: 4.1, denner: 3.5, aldi: 3.3 } },
  { id: "pasta", name: "Pasta 500g", unit: "pz", prices: { migros: 1.1, coop: 1.15, denner: 0.95, aldi: 0.85 } },
  { id: "riso", name: "Riso 1kg", unit: "pz", prices: { migros: 3.2, coop: 3.3, denner: 2.8, aldi: 2.6 } },
];
