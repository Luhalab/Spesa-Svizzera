import React, { useState } from "react";
import { ShoppingCart, MapPin, X, TrendingDown, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { CHAINS } from "../lib/demoCatalog";

const money = (v) => (v == null ? "—" : `CHF ${v.toFixed(2)}`);

export default function Home() {
  const [step, setStep] = useState("lista");
  const [list, setList] = useState([]); // [{ id, name, unit, qty, prices, source }]
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [postalCode, setPostalCode] = useState("8000");
  const [stores, setStores] = useState(null);
  const [loadingStores, setLoadingStores] = useState(false);

  const handleSearch = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
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

  const loadStores = async () => {
    setLoadingStores(true);
    try {
      // Geocoding CAP → lat/lng semplificato: in produzione usare una tabella
      // CAP svizzeri reale (swissgroceries-mcp include già questa lookup).
      const res = await fetch(`/api/stores?lat=47.3769&lng=8.5417`);
      const data = await res.json();
      setStores(data.stores || []);
    } catch {
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  };

  return (
    <div style={styles.page}>
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
                placeholder="Cerca un prodotto reale (es. latte)"
                style={styles.textInput}
              />
              <button onClick={handleSearch} style={styles.addBtn} disabled={searching}>
                {searching ? <Loader2 size={16} className="spin" /> : "+"}
              </button>
            </div>
            {searchError && <div style={styles.errorText}>{searchError}</div>}
            <div style={styles.footnoteSmall}>
              La ricerca chiama /api/search, che interroga swissgroceries-mcp in tempo reale
              (con fallback ai dati demo se non configurato — vedi README).
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
              onClick={() => {
                setStep("risultato");
                loadStores();
              }}
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
                  </div>
                );
              })}
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <MapPin size={18} />
              <span style={styles.panelTitle}>Negozi vicini</span>
            </div>
            <div style={styles.inlineRow}>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="CAP (es. 8000)"
                style={styles.textInput}
              />
              <button onClick={loadStores} style={styles.addBtn}>
                {loadingStores ? <Loader2 size={16} /> : "→"}
              </button>
            </div>
            <ul style={styles.storeList}>
              {(stores || []).slice(0, 6).map((s) => (
                <li key={s.id} style={styles.storeItem}>
                  <div style={{ flex: 1 }}>{s.name}</div>
                  <div style={styles.storeKm}>{s.distanceKm.toFixed(1)} km</div>
                </li>
              ))}
            </ul>
            <div style={styles.footnoteSmall}>
              Dati reali da OpenStreetMap / Overpass API — nessuna chiave richiesta.
            </div>
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
  page: { minHeight: "100vh", paddingBottom: 40 },
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
  storeList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  storeItem: { display: "flex", padding: "6px 0", borderBottom: "1px solid #F0EEE8", fontSize: 13 },
  storeKm: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#5A5850" },
};
