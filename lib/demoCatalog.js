// Catalogo di fallback — usato solo se la chiamata reale a swissgroceries-mcp
// fallisce (es. backend non ancora collegato). In produzione i dati veri
// arrivano da lib/mcpClient.js (via backend/) o dal server MCP diretto.

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
  { id: "pollo", name: "Petto di pollo 400g", unit: "conf", prices: { migros: 7.9, coop: 8.2, denner: 6.9, aldi: null } },
  { id: "mele", name: "Mele 1kg", unit: "kg", prices: { migros: 3.5, coop: 3.6, denner: 3.1, aldi: 2.9 } },
  { id: "banane", name: "Banane 1kg", unit: "kg", prices: { migros: 2.3, coop: 2.4, denner: 2.1, aldi: 1.95 } },
  { id: "yogurt", name: "Yogurt natura 4x150g", unit: "conf", prices: { migros: 2.1, coop: 2.15, denner: 1.85, aldi: 1.7 } },
  { id: "formaggio", name: "Formaggio Gruyère 200g", unit: "conf", prices: { migros: 5.4, coop: 5.6, denner: 4.9, aldi: null } },
  { id: "burro", name: "Burro 250g", unit: "conf", prices: { migros: 3.7, coop: 3.8, denner: 3.4, aldi: 3.2 } },
  { id: "caffe", name: "Caffè macinato 500g", unit: "conf", prices: { migros: 8.9, coop: 9.2, denner: 7.8, aldi: 7.2 } },
  { id: "olio", name: "Olio d'oliva 1L", unit: "pz", prices: { migros: 9.9, coop: 10.4, denner: 8.6, aldi: 7.9 } },
  { id: "detersivo", name: "Detersivo lavatrice 2L", unit: "pz", prices: { migros: 12.9, coop: 13.5, denner: 10.9, aldi: 9.9 } },
  { id: "cartaig", name: "Carta igienica 24 rotoli", unit: "conf", prices: { migros: 11.9, coop: 12.4, denner: 9.9, aldi: 9.5 } },
];

// Coordinate reali dei centri città, usate per interrogare Overpass API
export const CITIES = {
  Zurigo: { lat: 47.3769, lng: 8.5417 },
  Winterthur: { lat: 47.5, lng: 8.75 },
  Weinfelden: { lat: 47.5667, lng: 9.1 },
  "San Gallo": { lat: 47.4245, lng: 9.3767 },
  Lucerna: { lat: 47.0502, lng: 8.3093 },
  Ginevra: { lat: 46.2044, lng: 6.1432 },
  Basilea: { lat: 47.5596, lng: 7.5886 },
  Berna: { lat: 46.948, lng: 7.4474 },
  Losanna: { lat: 46.5197, lng: 6.6323 },
  Lugano: { lat: 46.0037, lng: 8.9511 },
  Bellinzona: { lat: 46.1944, lng: 9.0175 },
  Friburgo: { lat: 46.8065, lng: 7.1619 },
  Thun: { lat: 46.758, lng: 7.628 },
  Sion: { lat: 46.2331, lng: 7.3606 },
};

// Normalizza testo (minuscolo, senza accenti/punteggiatura) per il matching
const normalize = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Trova il prodotto del catalogo demo più simile al termine cercato
// (usato dal fallback quando il backend reale non è raggiungibile)
export function findDemoProduct(rawTerm) {
  const norm = normalize(rawTerm);
  if (!norm) return null;
  const termWords = norm.split(" ").filter(Boolean);
  let best = null;
  let bestScore = 0;
  DEMO_CATALOG.forEach((p) => {
    const pname = normalize(p.name);
    const pwords = pname.split(" ").filter(Boolean);
    let score = 0;
    if (pname.includes(norm) || norm.includes(normalize(p.id))) score += 5;
    termWords.forEach((w) => {
      if (pwords.some((pw) => pw === w || pw.startsWith(w) || w.startsWith(pw))) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  });
  return bestScore > 0 ? best : null;
}
