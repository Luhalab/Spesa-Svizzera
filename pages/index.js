import React, { useState } from "react";
import {
  ShoppingCart,
  MapPin,
  X,
  TrendingDown,
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  Check,
  Loader2,
} from "lucide-react";

const CHAINS = [
  { id: "migros", name: "Migros", color: "#FF8A3D" },
  { id: "coop", name: "Coop", color: "#FF5A5F" },
];

// Coordinate centro Winterthur, per i negozi vicini via Overpass API
const WINTERTHUR = { lat: 47.5, lng: 8.75 };

const money = (v) => (v == null ? "—" : `CHF ${v.toFixed(2)}`);

const parseNoteLine = (line) => {
  const clean = line.replace(/^[\s\-\*•\u2022\u2610\u2611\[\]xX\d]+/, "").trim();
  return clean || line.trim();
};

export default function Home() {
  const [step, setStep] = useState("lista"); // "lista" | "risultato"
  const [pending, setPending] = useState([]); // termini da cercare, non ancora interrogati
  const [manualInput, setManualInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [noteText, setNoteText] = useState("");

  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [items, setItems] = useState([]); // risultati dopo la query
  const [source, setSource] = useState(null);

  const [stores, setStores] = useState(null);
  const [loadingStores, setLoadingStores] = useState(false);

  const addTerm = () => {
    const t = manualInput.trim();
    if (!t) return;
    if (!pending.includes(t)) setPending((p) => [...p, t]);
    setManualInput("");
  };

  const removeTerm = (i) => setPending((p) => p.filter((_, idx) => idx !== i));

  const importNote = () => {
    const lines = noteText
      .split("\n")
      .map(parseNoteLine)
      .filter(Boolean);
    setPending((p) => {
      const merged = [...p];
      lines.forEach((l) => {
        if (!merged.includes(l)) merged.push(l);
      });
      return merged;
    });
    setNoteText("");
    setShowImport(false);
  };

  const runSearch = async () => {
    if (pending.length === 0) return;
    setSearching(true);
    setSearchErr("");
    try {
      const res = await fetch("/api/search-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: pending }),
      });
      const data = await res.json();
      setItems(data.items || []);
      setSource(data.source);
      setStep("risultato");
      loadStores();
    } catch (err) {
      setSearchErr("Errore di rete durante la ricerca. Riprova.");
    } finally {
      setSearching(false);
    }
  };

  const loadStores = async () => {
    setLoadingStores(true);
    try {
      const res = await fetch(`/api/stores?lat=${WINTERTHUR.lat}&lng=${WINTERTHUR.lng}`);
      const data = await res.json();
      setStores(data.nearestByChain || null);
    } catch {
      setStores(null);
    } finally {
      setLoadingStores(false);
    }
  };

  // Righe della tabella: comparabili (in entrambi) contano nel totale,
  // quelle presenti solo in un negozio compaiono comunque ma sono escluse.
  const comparableItems = items.filter((i) => i.prices.migros != null && i.prices.coop != null);
  const totals = CHAINS.reduce((acc, c) => {
    acc[c.id] = comparableItems.reduce((sum, i) => sum + (i.prices[c.id] || 0), 0);
    return acc;
  }, {});
  const cheapestChain =
    comparableItems.length > 0 ? (totals.migros <= totals.coop ? "migros" : "coop") : null;

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #14140F; }
        textarea::placeholder, input::placeholder { color: #6B6A63; }
        select { color-scheme: dark; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>W</div>
          <div>
            <div style={styles.eyebrow}>Migros vs Coop · Winterthur</div>
            <h1 style={styles.h1}>{step === "lista" ? "Costruisci la lista" : "Confronto prezzi"}</h1>
          </div>
        </div>
      </header>

      {step === "lista" && (
        <main style={styles.mainSingle}>
          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <ShoppingCart size={18} />
              <span style={styles.panelTitle}>Prodotti da cercare</span>
              <span style={styles.count}>{pending.length}</span>
            </div>

            <div style={styles.inlineRow}>
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTerm()}
                placeholder="es. olio, pasta Barilla, cetrioli…"
                style={styles.textInput}
              />
              <button onClick={addTerm} style={styles.addBtn}>
                +
              </button>
            </div>

            <button onClick={() => setShowImport((v) => !v)} style={styles.importToggle}>
              <ClipboardPaste size={14} />
              {showImport ? "Nascondi import da nota" : "Incolla una nota (Google Keep, Note, ecc.)"}
            </button>

            {showImport && (
              <div style={styles.importBox}>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={"Incolla qui la tua lista, un prodotto per riga\nes.\nolio\npasta barilla\ncetrioli"}
                  style={styles.textarea}
                  rows={5}
                />
                <button
                  onClick={importNote}
                  disabled={!noteText.trim()}
                  style={{ ...styles.secondaryBtn, opacity: !noteText.trim() ? 0.4 : 1 }}
                >
                  <Check size={14} />
                  Aggiungi alla lista
                </button>
              </div>
            )}

            <ul style={styles.list}>
              {pending.map((t, i) => (
                <li key={i} style={styles.listItem}>
                  <span style={{ flex: 1 }}>{t}</span>
                  <button onClick={() => removeTerm(i)} style={styles.iconBtn}>
                    <X size={15} />
                  </button>
                </li>
              ))}
              {pending.length === 0 && <li style={styles.empty}>Nessun prodotto aggiunto ancora.</li>}
            </ul>

            {searchErr && <div style={styles.errorText}>{searchErr}</div>}

            <button
              disabled={pending.length === 0 || searching}
              onClick={runSearch}
              style={{ ...styles.primaryBtn, opacity: pending.length === 0 ? 0.4 : 1 }}
            >
              {searching ? (
                <>
                  <Loader2 size={16} className="spin" /> Cerco i prezzi…
                </>
              ) : (
                <>
                  Cerca prezzi ({pending.length}) <ArrowRight size={16} />
                </>
              )}
            </button>
            <div style={styles.footnoteSmall}>
              La ricerca parte una sola volta per tutti i prodotti aggiunti, non ad ogni singolo
              inserimento.
            </div>
          </section>
        </main>
      )}

      {step === "risultato" && (
        <main style={styles.main}>
          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <TrendingDown size={18} />
              <span style={styles.panelTitle}>Tabella di confronto</span>
            </div>

            {source === "demo" && (
              <div style={styles.demoWarning}>
                Alcuni prezzi sono dati demo (la ricerca live non ha risposto per tutti i prodotti).
              </div>
            )}

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thProduct}>Prodotto</th>
                    <th style={styles.th}>Migros</th>
                    <th style={styles.th}>Coop</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const excluded = item.prices.migros == null || item.prices.coop == null;
                    return (
                      <tr key={i} style={excluded ? styles.trExcluded : undefined}>
                        <td style={styles.tdProduct}>
                          {item.name}
                          {excluded && <div style={styles.excludedNote}>escluso dal totale</div>}
                        </td>
                        <td style={styles.td}>{money(item.prices.migros)}</td>
                        <td style={styles.td}>{money(item.prices.coop)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={styles.tdTotalLabel}>Totale</td>
                    <td style={{ ...styles.tdTotal, color: cheapestChain === "migros" ? "#7CD98A" : "#E8E6DE" }}>
                      {comparableItems.length > 0 ? money(totals.migros) : "—"}
                    </td>
                    <td style={{ ...styles.tdTotal, color: cheapestChain === "coop" ? "#7CD98A" : "#E8E6DE" }}>
                      {comparableItems.length > 0 ? money(totals.coop) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {cheapestChain && (
              <div style={styles.verdictBox}>
                <div style={styles.verdictLabel}>Conviene andare da</div>
                <div style={styles.verdictStore}>{cheapestChain === "migros" ? "Migros" : "Coop"}</div>
                <div style={styles.verdictSaving}>
                  risparmi {money(Math.abs(totals.migros - totals.coop))} rispetto all'altro negozio
                  {items.length > comparableItems.length && (
                    <> · {items.length - comparableItems.length} prodotto/i escluso/i dal calcolo</>
                  )}
                </div>
              </div>
            )}
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <MapPin size={18} />
              <span style={styles.panelTitle}>Negozi a Winterthur</span>
            </div>
            {loadingStores && <div style={styles.footnoteSmall}>Cerco i negozi vicini…</div>}
            <ul style={styles.storeList}>
              {CHAINS.map((c) => {
                const s = stores?.[c.id];
                return (
                  <li key={c.id} style={styles.storeItem}>
                    <span style={{ ...styles.dot, background: c.color }} />
                    <div style={{ flex: 1 }}>
                      <div style={styles.storeName}>{s ? s.name : "Nessun negozio trovato"}</div>
                      <div style={styles.storeChain}>{c.name}</div>
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
  page: { minHeight: "100vh", background: "#14140F", color: "#E8E6DE", fontFamily: "'Inter', sans-serif", paddingBottom: 40 },
  header: { borderBottom: "1px solid #2A2A22", padding: "28px 24px 20px" },
  brandRow: { display: "flex", alignItems: "center", gap: 14 },
  brandMark: { width: 44, height: 44, background: "#D8232A", color: "#F5F3EA", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, flexShrink: 0 },
  eyebrow: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#8C8A80" },
  h1: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 21, margin: 0, color: "#F5F3EA" },
  main: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, padding: 24, maxWidth: 1000, margin: "0 auto" },
  mainSingle: { padding: 24, maxWidth: 520, margin: "0 auto" },
  panel: { background: "#1C1C15", border: "1px solid #2A2A22", borderRadius: 6, padding: 18 },
  panelHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #2A2A22" },
  panelTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, flex: 1, color: "#F5F3EA" },
  count: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: "#2A2A22", padding: "2px 8px", borderRadius: 20, color: "#C9C7BC" },
  inlineRow: { display: "flex", gap: 8, marginBottom: 10 },
  textInput: { flex: 1, padding: "10px 12px", border: "1px solid #3A3A30", borderRadius: 4, fontSize: 13.5, background: "#14140F", color: "#E8E6DE" },
  addBtn: { width: 40, border: "1px solid #D8232A", background: "#D8232A", color: "#F5F3EA", borderRadius: 4, cursor: "pointer", fontSize: 16 },
  importToggle: { display: "flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "#B0AEA2", fontSize: 12.5, padding: "6px 0 12px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 },
  importBox: { background: "#22221A", borderRadius: 4, padding: 12, marginBottom: 12 },
  textarea: { width: "100%", padding: "10px 12px", border: "1px solid #3A3A30", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5, resize: "vertical", marginBottom: 8, background: "#14140F", color: "#E8E6DE" },
  secondaryBtn: { display: "flex", alignItems: "center", gap: 7, padding: "9px 14px", background: "#F5F3EA", color: "#14140F", border: "none", borderRadius: 4, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: "pointer" },
  list: { listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  listItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#22221A", borderRadius: 4, fontSize: 13.5 },
  iconBtn: { border: "none", background: "transparent", color: "#8C8A80", cursor: "pointer" },
  empty: { fontSize: 13, color: "#6B6A63", padding: "10px 0" },
  errorText: { fontSize: 11.5, color: "#FF8A80", marginTop: 8 },
  primaryBtn: { marginTop: 18, width: "100%", padding: "13px 16px", background: "#D8232A", color: "#F5F3EA", border: "none", borderRadius: 4, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  footnoteSmall: { fontSize: 11, color: "#6B6A63", marginTop: 10, lineHeight: 1.5 },
  demoWarning: { fontSize: 11.5, color: "#E0B84D", background: "#2A2410", padding: "8px 10px", borderRadius: 4, marginBottom: 12 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thProduct: { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #3A3A30", color: "#8C8A80", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  th: { textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #3A3A30", color: "#8C8A80", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  tdProduct: { padding: "10px 6px", borderBottom: "1px solid #22221A" },
  td: { padding: "10px 6px", borderBottom: "1px solid #22221A", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" },
  trExcluded: { opacity: 0.55 },
  excludedNote: { fontSize: 10, color: "#E0B84D", marginTop: 2 },
  tdTotalLabel: { padding: "10px 6px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 },
  tdTotal: { padding: "10px 6px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 16 },
  verdictBox: { marginTop: 16, padding: 14, background: "#16241A", borderRadius: 4, border: "1px solid #3F7D5C" },
  verdictLabel: { fontSize: 11, color: "#8C8A80", textTransform: "uppercase", letterSpacing: 0.5 },
  verdictStore: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: "#7CD98A", margin: "2px 0" },
  verdictSaving: { fontSize: 12, color: "#B0AEA2" },
  storeList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  storeItem: { display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #22221A", fontSize: 13 },
  dot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  storeName: { fontSize: 13, fontWeight: 500 },
  storeChain: { fontSize: 11, color: "#8C8A80" },
  storeKm: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#B0AEA2" },
  backBtn: { gridColumn: "1 / -1", justifySelf: "start", padding: "10px 16px", background: "transparent", border: "1px solid #3A3A30", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#E8E6DE" },
};
