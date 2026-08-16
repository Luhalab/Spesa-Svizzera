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
  CircleSlash,
} from "lucide-react";

const CHAINS = [
  { id: "migros", name: "Migros", color: "#FF8A3D" },
  { id: "coop", name: "Coop", color: "#FF5A5F" },
  { id: "denner", name: "Denner", color: "#4A90E2" },
  { id: "ottos", name: "Otto's", color: "#4DBD9E" },
];

const WINTERTHUR = { lat: 47.5, lng: 8.75 };

const money = (v) => (v == null ? "—" : `CHF ${v.toFixed(2)}`);

const parseNoteLine = (line) => {
  const clean = line.replace(/^[\s\-\*•\u2022\u2610\u2611\[\]xX\d]+/, "").trim();
  return clean || line.trim();
};

export default function Home() {
  const [step, setStep] = useState("lista"); // "lista" | "seleziona" | "risultato"
  const [pending, setPending] = useState([]);
  const [manualInput, setManualInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [noteText, setNoteText] = useState("");

  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [searchResults, setSearchResults] = useState([]); // [{term, candidates:{migros:[],coop:[]}}]
  const [selections, setSelections] = useState({}); // { term: { migros: idx|null, coop: idx|null } }
  const [source, setSource] = useState(null);

  const [items, setItems] = useState([]); // risultato finale confermato
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
    const lines = noteText.split("\n").map(parseNoteLine).filter(Boolean);
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
      const results = data.items || [];
      setSearchResults(results);
      setSource(data.source);

      // Preseleziona il più economico per ogni catena, dove disponibile
      const initSel = {};
      results.forEach((r) => {
        const sel = {};
        CHAINS.forEach((c) => {
          sel[c.id] = r.candidates[c.id]?.length > 0 ? 0 : null;
        });
        initSel[r.term] = sel;
      });
      setSelections(initSel);
      setStep("seleziona");
    } catch (err) {
      setSearchErr("Errore di rete durante la ricerca. Riprova.");
    } finally {
      setSearching(false);
    }
  };

  const selectCandidate = (term, chainId, idx) => {
    setSelections((s) => ({
      ...s,
      [term]: { ...s[term], [chainId]: s[term][chainId] === idx ? null : idx },
    }));
  };

  const confirmSelection = () => {
    const finalItems = searchResults.map((r) => {
      const prices = {};
      let name = r.term;
      CHAINS.forEach((c) => {
        const selIdx = selections[r.term]?.[c.id];
        const chosen = selIdx != null ? r.candidates[c.id][selIdx] : null;
        prices[c.id] = chosen?.price ?? null;
        if (chosen?.name && name === r.term) name = chosen.name;
      });
      return { term: r.term, name, prices };
    });
    setItems(finalItems);
    setStep("risultato");
    loadStores();
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

  const comparableItems = items.filter((i) => CHAINS.every((c) => i.prices[c.id] != null));
  const totals = CHAINS.reduce((acc, c) => {
    acc[c.id] = comparableItems.reduce((sum, i) => sum + (i.prices[c.id] || 0), 0);
    return acc;
  }, {});
  const totalsList = CHAINS.map((c) => ({ id: c.id, name: c.name, total: totals[c.id] }));
  const cheapestChain =
    comparableItems.length > 0
      ? totalsList.reduce((a, b) => (b.total < a.total ? b : a)).id
      : null;
  const priciestTotal =
    comparableItems.length > 0 ? Math.max(...totalsList.map((t) => t.total)) : null;
  const cheapestTotal =
    comparableItems.length > 0 ? Math.min(...totalsList.map((t) => t.total)) : null;

  return (
    <div style={styles.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Mono:wght@400;600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #14140F; }
        textarea::placeholder, input::placeholder { color: #6B6A63; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.brandRow}>
          <div style={styles.brandMark}>W</div>
          <div>
            <div style={styles.eyebrow}>Migros · Coop · Denner · Otto's · Winterthur</div>
            <h1 style={styles.h1}>
              {step === "lista" && "Costruisci la lista"}
              {step === "seleziona" && "Scegli i prodotti giusti"}
              {step === "risultato" && "Confronto prezzi"}
            </h1>
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
                placeholder="es. olio, pasta, sale…"
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
                  placeholder={"Incolla qui la tua lista, un prodotto per riga"}
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
              {searching ? "Cerco i prezzi…" : `Cerca prezzi (${pending.length})`}
              {!searching && <ArrowRight size={16} />}
            </button>
          </section>
        </main>
      )}

      {step === "seleziona" && (
        <main style={styles.mainSingle}>
          {source === "demo" && (
            <div style={styles.demoWarning}>
              Alcuni risultati sono dati demo (la ricerca live non ha risposto per tutti).
            </div>
          )}
          {searchResults.map((r) => (
            <section key={r.term} style={styles.panel}>
              <div style={styles.selTermTitle}>"{r.term}"</div>
              {CHAINS.map((chain) => {
                const cands = r.candidates[chain.id];
                const selIdx = selections[r.term]?.[chain.id];
                return (
                  <div key={chain.id} style={styles.selChainBlock}>
                    <div style={styles.selChainLabel}>
                      <span style={{ ...styles.dot, background: chain.color }} />
                      {chain.name}
                      <span style={styles.selCount}>
                        {cands.length === 0 ? "nessun risultato" : `${cands.length} trovato/i`}
                        {r.rawCounts && r.rawCounts[chain.id] !== cands.length && (
                          <> (grezzo: {r.rawCounts[chain.id]})</>
                        )}
                      </span>
                    </div>
                    {cands.length === 0 ? (
                      <div style={styles.selNone}>
                        <CircleSlash size={13} /> Non trovato su {chain.name}
                      </div>
                    ) : (
                      <div style={styles.selOptions}>
                        {cands.map((c, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectCandidate(r.term, chain.id, idx)}
                            style={{
                              ...styles.selOption,
                              ...(selIdx === idx ? styles.selOptionActive : {}),
                            }}
                          >
                            <span style={{ flex: 1, textAlign: "left" }}>
                              {c.name}
                              {c.brand && <span style={styles.selBrand}> · {c.brand}</span>}
                            </span>
                            <span style={styles.selPrice}>{money(c.price)}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => selectCandidate(r.term, chain.id, -1)}
                          style={{
                            ...styles.selOption,
                            ...(selIdx == null ? styles.selOptionActive : {}),
                            justifyContent: "center",
                            color: "#8C8A80",
                          }}
                        >
                          Nessuno di questi
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          ))}

          <button onClick={confirmSelection} style={styles.primaryBtn}>
            Vedi confronto <ArrowRight size={16} />
          </button>
          <button onClick={() => setStep("lista")} style={styles.backBtn}>
            <ArrowLeft size={16} /> Modifica lista
          </button>
        </main>
      )}

      {step === "risultato" && (
        <main style={styles.main}>
          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <TrendingDown size={18} />
              <span style={styles.panelTitle}>Tabella di confronto</span>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.thProduct}>Prodotto</th>
                    {CHAINS.map((c) => (
                      <th key={c.id} style={styles.th}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const excluded = CHAINS.some((c) => item.prices[c.id] == null);
                    return (
                      <tr key={i} style={excluded ? styles.trExcluded : undefined}>
                        <td style={styles.tdProduct}>
                          {item.name}
                          {excluded && <div style={styles.excludedNote}>escluso dal totale</div>}
                        </td>
                        {CHAINS.map((c) => (
                          <td key={c.id} style={styles.td}>
                            {money(item.prices[c.id])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={styles.tdTotalLabel}>Totale</td>
                    {CHAINS.map((c) => (
                      <td
                        key={c.id}
                        style={{ ...styles.tdTotal, color: cheapestChain === c.id ? "#7CD98A" : "#E8E6DE" }}
                      >
                        {comparableItems.length > 0 ? money(totals[c.id]) : "—"}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>

            {cheapestChain && (
              <div style={styles.verdictBox}>
                <div style={styles.verdictLabel}>Conviene andare da</div>
                <div style={styles.verdictStore}>
                  {CHAINS.find((c) => c.id === cheapestChain)?.name}
                </div>
                <div style={styles.verdictSaving}>
                  risparmi {money(priciestTotal - cheapestTotal)} rispetto al negozio più caro tra
                  quelli confrontati
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
          </section>

          <button onClick={() => setStep("lista")} style={styles.backBtn}>
            <ArrowLeft size={16} /> Nuova ricerca
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
  mainSingle: { padding: 24, maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 },
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
  primaryBtn: { width: "100%", padding: "13px 16px", background: "#D8232A", color: "#F5F3EA", border: "none", borderRadius: 4, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" },
  footnoteSmall: { fontSize: 11, color: "#6B6A63", marginTop: 10, lineHeight: 1.5 },
  demoWarning: { fontSize: 11.5, color: "#E0B84D", background: "#2A2410", padding: "8px 10px", borderRadius: 4 },
  selTermTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#F5F3EA" },
  selChainBlock: { marginBottom: 14 },
  selChainLabel: { display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, marginBottom: 6 },
  selCount: { marginLeft: "auto", fontSize: 10.5, color: "#8C8A80", fontWeight: 400 },
  selNone: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8C8A80", padding: "8px 10px", background: "#22221A", borderRadius: 4 },
  selOptions: { display: "flex", flexDirection: "column", gap: 5 },
  selOption: { display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: "#22221A", border: "1px solid #3A3A30", borderRadius: 4, color: "#C9C7BC", fontSize: 12.5, cursor: "pointer", textAlign: "left" },
  selOptionActive: { borderColor: "#3F7D5C", background: "#16241A", color: "#F5F3EA" },
  selBrand: { color: "#8C8A80", fontStyle: "italic" },
  selPrice: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 },
  dot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  backBtn: { padding: "10px 16px", background: "transparent", border: "1px solid #3A3A30", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#E8E6DE" },
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
  storeName: { fontSize: 13, fontWeight: 500 },
  storeChain: { fontSize: 11, color: "#8C8A80" },
  storeKm: { fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#B0AEA2" },
};
