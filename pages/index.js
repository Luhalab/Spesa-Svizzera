import React, { useState, useEffect } from "react";
import { ShoppingCart, MapPin, X, TrendingDown, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { CHAINS, CITIES } from "../lib/demoCatalog";

const money = (v) => (v == null ? "—" : `CHF ${v.toFixed(2)}`);

// Se NEXT_PUBLIC_BACKEND_URL è impostato (backend Railway/Render sempre acceso),
// lo usiamo per avere prezzi reali. Altrimenti si torna alla funzione serverless
// di Vercel /api/search, che ha il fallback ai dati demo.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export default function Home() {
  const [step, setStep] = useState("lista");
  const [list, setList] = useState([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [city, setCity] = useState("Zurigo");
  const [stores, setStores] = useState(null);
  const [loadingStores, setLoadingStores] = useState(false);

  const handleSearch = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearchError("");
    try {
      const url = BACKEND_URL
        ? `${BACKEND_URL}/search?q=${encodeURIComponent(term)}`
        : `/api/search?q=${encodeURIComponent(term)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setSearchError(`Nessun prodotto trovato per "${term}"`);
        return;
      }
      const product = data.results[0];
      setList((l) => {
        const idx = l.findIndex((i) => i.id === product.id);
        if (idx >= 0) {
          const copy = [...l];
          copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
          return copy;
        }
        return [...l, { ...product, qty: 1, source: data.source }];
      });
      setQuery("");
    } catch (err) {
      setSearchError("Errore di rete durante la ricerca");
    } finally {
      setSearching(false);
    }
  };

  const removeItem = (id) => setList((l) => l.filter((i) => i.id !== id));
  const setQty = (id, qty) =>
    setList((l) => l.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i)));

  const totals = CHAINS.map((chain) => {
    let total = 0;
    let missing = 0;
    list.forEach(({ qty, prices }) => {
      const p = prices?.[chain.id];
      if (p == null) missing += 1;
      else total += p * qty;
    });
    return { ...chain, total, missing };
  });

  const fullyAvailable = totals.filter((t) => t.missing === 0);
  const cheapest =
    fullyAvailable.length > 0 ? fullyAvailable.reduce((a, b) => (b.total < a.total ? b : a)) : null;

  const multiStoreTotal = list.reduce((sum, { qty, prices }) => {
    const vals = CHAINS.map((c) => prices?.[c.id]).filter((v) => v != null);
    if (vals.length === 0) return sum;
    return sum + Math.min(...vals) * qty;
  }, 0);
  const savings = cheapest ? cheapest.total - multiStoreTotal : 0;

  const loadStores = async (cityName) => {
    setLoadingStores(true);
    const coords = CITIES[cityName];
    try {
      const res = await fetch(`/api/stores?lat=${coords.lat}&lng=${coords.lng}`);
      const data = await res.json();
      setStores(data.nearestByChain || null);
    } catch {
      setStores(null);
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    if (step === "risultato") loadStores(city);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #FAFAF7; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>CH</div>
          <div>
            <div style={styles.eyebrow}>Confronto prezzi · Svizzera</div>
            <h1 style={styles.h1}>{step === "lista" ? "Crea la tua lista della spesa" : "Dove conviene fare la spesa"}</h1>
          </div>
        </div>
      </header>

      {step === "lista" && (
        <main style={styles.mainSingle}>
          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <ShoppingCart size={18} />
              <span style={styles.panelTitle}>Lista della spesa</span>
              <span style={styles.count}>{list.length}</span>
            </div>

            <div style={styles.inlineRow}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Cerca un prodotto (es. olio, latte…)"
                style={styles.textInput}
              />
              <button onClick={handleSearch} style={styles.addBtn} disabled={searching}>
                {searching ? "…" : "+"}
              </button>
            </div>
            {searchError && <div style={styles.errorText}>{searchError}</div>}
            <div style={styles.footnoteSmall}>
              {BACKEND_URL
                ? "Ricerca collegata al backend reale."
                : "Backend non ancora collegato: ricerca in modalità demo (vedi README, sezione 3)."}
            </div>

            <ul style={styles.list}>
              {list.map(({ id, name, unit, qty, source }) => (
                <li key={id} style={styles.listItem}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.itemName}>{name}</div>
                    <div style={styles.itemUnit}>
                      {unit} {source === "demo" && "· dati demo"}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(id, parseInt(e.target.value) || 1)}
                    style={styles.qtyInput}
                  />
                  <button onClick={() => removeItem(id)} style={styles.iconBtn}>
                    <X size={15} />
                  </button>
                </li>
              ))}
              {list.length === 0 && <li style={styles.empty}>La lista è vuota.</li>}
            </ul>

            <button
              disabled={list.length === 0}
              onClick={() => setStep("risultato")}
              style={{ ...styles.primaryBtn, opacity: list.length === 0 ? 0.4 : 1 }}
            >
              Vedi confronto prezzi <ArrowRight size={16} />
            </button>
          </section>
        </main>
      )}

      {step === "risultato" && (
        <main style={styles.main}>
          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <TrendingDown size={18} />
              <span style={styles.panelTitle}>Confronto per negozio</span>
            </div>
            <div style={styles.chainGrid}>
              {totals.map((t) => {
                const isCheapest = cheapest && t.id === cheapest.id;
                return (
                  <div key={t.id} style={{ ...styles.chainCard, borderColor: isCheapest ? "#3F7D5C" : "#E4E2DC" }}>
                    <div style={styles.chainTop}>
                      <span style={{ ...styles.dot, background: t.color }} />
                      <span style={styles.chainName}>{t.name}</span>
                      {isCheapest && <span style={styles.badge}>più economico</span>}
                    </div>
                    <div style={styles.chainTotal}>{t.missing > 0 ? "—" : money(t.total)}</div>
                    {t.missing > 0 && <div style={styles.warn}>{t.missing} prodotto/i non disponibile/i</div>}
                  </div>
                );
              })}
            </div>

            {list.length > 0 && (
              <div style={styles.multiBox}>
                <div style={styles.multiTop}>Comprando ogni prodotto dove costa meno</div>
                <div style={styles.multiRow}>
                  <span style={styles.multiTotal}>{money(multiStoreTotal)}</span>
                  {cheapest && savings > 0.01 && (
                    <span style={styles.multiSave}>risparmi {money(savings)} rispetto a {cheapest.name} da solo</span>
                  )}
                </div>
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <MapPin size={18} />
              <span style={styles.panelTitle}>Negozio più vicino</span>
            </div>

            <select
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                loadStores(e.target.value);
              }}
              style={styles.select}
            >
              {Object.keys(CITIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {loadingStores && <div style={styles.footnoteSmall}>Cerco i negozi vicini…</div>}

            <ul style={styles.storeList}>
              {CHAINS.map((chain) => {
                const s = stores?.[chain.id];
                return (
                  <li key={chain.id} style={styles.storeItem}>
                    <span style={{ ...styles.dot, background: chain.color }} />
                    <div style={{ flex: 1 }}>
                      <div style={styles.storeName}>{s ? s.name : "Nessun negozio trovato nel raggio"}</div>
                      <div style={styles.storeChain}>{chain.name}</div>
                    </div>
                    {s && <div style={styles.storeKm}>{s.distanceKm.toFixed(1)} km</div>}
                  </li>
                );
              })}
            </ul>
            <div style={styles.footnoteSmall}>Dati reali da OpenStreetMap / Overpass API.</div>
          </section>

          <button onClick={() => setStep("lista")} style={styles.backBtn}>
            <ArrowLeft size={16} /> Modifica lista
          </button>
        </main>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", paddingBottom: 40, color: "#1A1A1A", fontFamily: "'Inter', sans-serif" },
  header: { borderBottom: "1px solid #E4E2DC", padding: "28px 24px 20px" },
  brandRow: { display: "flex", alignItems: "center", gap: 14 },
  brandMark: {
    width: 44, height: 44, background: "#D8232A", color: "#FAFAF7",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15,
  },
  eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: "uppercase", color: "#8A8A85" },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, margin: 0 },
  main: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, padding: 24, maxWidth: 1100, margin: "0 auto" },
  mainSingle: { padding: 24, maxWidth: 520, margin: "0 auto" },
  panel: { background: "#FFFFFF", border: "1px solid #E4E2DC", borderRadius: 4, padding: 18 },
  panelHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #E4E2DC" },
  panelTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, flex: 1 },
  count: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: "#F4F1EA", padding: "2px 8px", borderRadius: 20 },
  inlineRow: { display: "flex", gap: 8, marginBottom: 8 },
  textInput: { flex: 1, padding: "10px 12px", border: "1px solid #E4E2DC", borderRadius: 4, fontSize: 13.5 },
  addBtn: { width: 40, border: "1px solid #1A1A1A", background: "#1A1A1A", color: "#FAFAF7", borderRadius: 4, cursor: "pointer" },
  errorText: { fontSize: 11.5, color: "#B0392B", marginBottom: 8 },
  select: { width: "100%", padding: "10px 12px", border: "1px solid #E4E2DC", borderRadius: 4, fontSize: 13.5, marginBottom: 12 },
  footnoteSmall: { fontSize: 11, color: "#8A8A85", marginBottom: 12, lineHeight: 1.5 },
  list: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  listItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0EEE8" },
  itemName: { fontSize: 13.5, fontWeight: 500 },
  itemUnit: { fontSize: 11.5, color: "#8A8A85" },
  qtyInput: { width: 44, padding: "5px 6px", border: "1px solid #E4E2DC", borderRadius: 4, textAlign: "center" },
  iconBtn: { border: "none", background: "transparent", color: "#8A8A85", cursor: "pointer" },
  empty: { fontSize: 13, color: "#8A8A85", padding: "10px 0" },
  primaryBtn: { marginTop: 18, width: "100%", padding: "13px 16px", background: "#D8232A", color: "#FAFAF7", border: "none", borderRadius: 4, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  backBtn: { gridColumn: "1 / -1", justifySelf: "start", padding: "10px 16px", background: "transparent", border: "1px solid #E4E2DC", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" },
  chainGrid: { display: "flex", flexDirection: "column", gap: 10 },
  chainCard: { border: "1px solid", borderRadius: 4, padding: "12px 14px" },
  chainTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  dot: { width: 9, height: 9, borderRadius: "50%" },
  chainName: { fontSize: 13.5, fontWeight: 600, flex: 1 },
  badge: { fontSize: 10, color: "#3F7D5C", border: "1px solid #3F7D5C", borderRadius: 20, padding: "2px 7px" },
  chainTotal: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 600 },
  warn: { fontSize: 11, color: "#B08900", marginTop: 4 },
  multiBox: { marginTop: 16, padding: 14, background: "#F4F1EA", borderRadius: 4 },
  multiTop: { fontSize: 12, color: "#5A5850", marginBottom: 6 },
  multiRow: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  multiTotal: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 20, fontWeight: 700, color: "#D8232A" },
  multiSave: { fontSize: 12, color: "#3F7D5C" },
  storeList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  storeItem: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #F0EEE8", fontSize: 13 },
  storeName: { fontSize: 13, fontWeight: 500 },
  storeChain: { fontSize: 11, color: "#8A8A85" },
  storeKm: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5A5850" },
};
