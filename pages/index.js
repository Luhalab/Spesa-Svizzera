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

const candidateKey = (c) => `${c.name}|${c.brand || ""}|${c.price}|${c.size || ""}`;
const normalizeBrand = (b) => (b || "").trim().toLowerCase();

const DIET_OPTIONS = [
  { id: "vegan", label: "Vegano" },
  { id: "vegetarian", label: "Vegetariano" },
  { id: "gluten-free", label: "Senza glutine" },
  { id: "organic", label: "Bio" },
];

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
  const [selections, setSelections] = useState({}); // { term: { migros: candidateKey|null|undefined } }
  const [excludedBrands, setExcludedBrands] = useState([]);
  const [brandInput, setBrandInput] = useState("");
  const [sortBy, setSortBy] = useState("price"); // "price" | "rating"
  const [dietFilters, setDietFilters] = useState([]); // es. ["vegan", "organic"]
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
      setSelections({}); // auto: il più economico tra i filtrati, finché l'utente non sceglie
      setStep("seleziona");
    } catch (err) {
      setSearchErr("Errore di rete durante la ricerca. Riprova.");
    } finally {
      setSearching(false);
    }
  };

  const filteredCandidates = (list) => {
    let result = (list || []).filter((c) => !excludedBrands.includes(normalizeBrand(c.brand)));
    if (dietFilters.length > 0) {
      result = result.filter((c) => dietFilters.every((d) => c.tags?.includes(d)));
    }
    result = [...result].sort((a, b) => {
      if (sortBy === "rating") {
        const ra = a.rating ?? -1;
        const rb = b.rating ?? -1;
        if (rb !== ra) return rb - ra;
      }
      return a.price - b.price;
    });
    return result;
  };

  const toggleDietFilter = (id) =>
    setDietFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const getSelectedCandidate = (term, chainId, list) => {
    const filtered = filteredCandidates(list);
    const sel = selections[term]?.[chainId];
    if (sel === null) return null; // l'utente ha scelto esplicitamente "nessuno"
    if (sel === undefined) return filtered[0] || null; // auto: il più economico tra i filtrati
    return filtered.find((c) => candidateKey(c) === sel) || filtered[0] || null;
  };

  const setSelection = (term, chainId, key) => {
    setSelections((s) => ({ ...s, [term]: { ...s[term], [chainId]: key } }));
  };

  const addExcludedBrand = () => {
    const b = normalizeBrand(brandInput);
    if (!b) return;
    if (!excludedBrands.includes(b)) setExcludedBrands((e) => [...e, b]);
    setBrandInput("");
  };
  const removeExcludedBrand = (b) => setExcludedBrands((e) => e.filter((x) => x !== b));

  const confirmSelection = () => {
    const finalItems = searchResults.map((r) => {
      const prices = {};
      const sizes = {};
      const details = {};
      let name = r.term;
      CHAINS.forEach((c) => {
        const chosen = getSelectedCandidate(r.term, c.id, r.candidates[c.id]);
        prices[c.id] = chosen?.price ?? null;
        sizes[c.id] = chosen?.size ?? null;
        details[c.id] = chosen
          ? {
              imageUrl: chosen.imageUrl,
              unitPrice: chosen.unitPrice,
              multipack: chosen.multipack,
              regularPrice: chosen.regularPrice,
            }
          : null;
        if (chosen?.name && name === r.term) name = chosen.name;
      });
      return { term: r.term, name, prices, sizes, details };
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

  // Secondo totale: "se faccio tutta la spesa qui", per catena — include
  // ogni prodotto trovato in quella catena, anche se manca nelle altre.
  // Non è un confronto alla pari (ogni negozio può coprire un numero
  // diverso di prodotti), ma dice quanto spenderesti davvero in quel
  // negozio con quello che riesci a trovarci.
  const fullCoverage = CHAINS.reduce((acc, c) => {
    const covered = items.filter((i) => i.prices[c.id] != null);
    acc[c.id] = {
      total: covered.reduce((sum, i) => sum + i.prices[c.id], 0),
      count: covered.length,
    };
    return acc;
  }, {});

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

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <span style={styles.panelTitle}>Escludi marche</span>
            </div>
            <div style={styles.inlineRow}>
              <input
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExcludedBrand()}
                placeholder="es. Barilla"
                style={styles.textInput}
              />
              <button onClick={addExcludedBrand} style={styles.addBtn}>
                +
              </button>
            </div>
            {excludedBrands.length > 0 && (
              <div style={styles.chipsRow}>
                {excludedBrands.map((b) => (
                  <button key={b} onClick={() => removeExcludedBrand(b)} style={styles.chip}>
                    {b} <X size={11} />
                  </button>
                ))}
              </div>
            )}
            <div style={styles.footnoteSmall}>
              Le marche escluse spariscono dai menu qui sotto per tutti i prodotti.
            </div>
          </section>

          <section style={styles.panel}>
            <div style={styles.panelHead}>
              <span style={styles.panelTitle}>Ordina e filtra</span>
            </div>
            <div style={styles.sortRow}>
              <span style={styles.sortLabel}>Ordina per</span>
              <div style={styles.sortToggle}>
                <button
                  onClick={() => setSortBy("price")}
                  style={{ ...styles.sortBtn, ...(sortBy === "price" ? styles.sortBtnActive : {}) }}
                >
                  Prezzo
                </button>
                <button
                  onClick={() => setSortBy("rating")}
                  style={{ ...styles.sortBtn, ...(sortBy === "rating" ? styles.sortBtnActive : {}) }}
                >
                  Valutazione
                </button>
              </div>
            </div>
            <div style={styles.chipsRow}>
              {DIET_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => toggleDietFilter(d.id)}
                  style={{
                    ...styles.dietChip,
                    ...(dietFilters.includes(d.id) ? styles.dietChipActive : {}),
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div style={styles.footnoteSmall}>
              La valutazione non è disponibile per tutte le catene — quando manca, l'ordinamento
              usa comunque il prezzo.
            </div>
          </section>

          {searchResults.map((r) => (
            <section key={r.term} style={styles.panel}>
              <div style={styles.selTermTitle}>"{r.term}"</div>
              {CHAINS.map((chain) => {
                const allCands = r.candidates[chain.id] || [];
                const cands = filteredCandidates(allCands);
                const selected = getSelectedCandidate(r.term, chain.id, allCands);
                const selValue = selected ? candidateKey(selected) : "__none__";
                return (
                  <div key={chain.id} style={styles.selRow}>
                    {selected?.imageUrl && (
                      <img src={selected.imageUrl} alt="" style={styles.thumb} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.selRowLabel}>
                        <span style={{ ...styles.dot, background: chain.color }} />
                        {chain.name}
                      </div>
                      {allCands.length === 0 ? (
                        <div style={styles.selNoneInline}>
                          <CircleSlash size={13} />{" "}
                          {r.chainErrors?.[chain.id] ? (
                            <span style={styles.errorInline}>bloccato: {r.chainErrors[chain.id]}</span>
                          ) : (
                            "non trovato"
                          )}
                        </div>
                      ) : cands.length === 0 ? (
                        <div style={styles.selNoneInline}>
                          <CircleSlash size={13} /> tutto escluso dal filtro marche
                        </div>
                      ) : (
                        <>
                          <select
                            value={selValue}
                            onChange={(e) =>
                              setSelection(r.term, chain.id, e.target.value === "__none__" ? null : e.target.value)
                            }
                            style={styles.selectDropdown}
                          >
                            {cands.map((c) => (
                              <option key={candidateKey(c)} value={candidateKey(c)}>
                                {c.name}
                                {c.brand ? ` · ${c.brand}` : ""}
                                {c.size ? ` (${c.size})` : ""}
                                {c.multipack ? ` [pacco da ${c.multipack.count}]` : ""}
                                {c.rating ? ` · ★${c.rating}` : ""} — {money(c.price)}
                                {c.regularPrice ? ` (invece di ${money(c.regularPrice)})` : ""}
                              </option>
                            ))}
                            <option value="__none__">Nessuno di questi</option>
                          </select>
                          {selected && (
                            <div style={styles.selDetail}>
                              {selected.unitPrice && (
                                <span>
                                  {money(selected.unitPrice.value)}/{selected.unitPrice.per}
                                </span>
                              )}
                              {selected.multipack && (
                                <span style={styles.multipackWarn}>
                                  ⚠ pacco da {selected.multipack.count}
                                  {selected.multipack.perUnitPrice
                                    ? ` · ${money(selected.multipack.perUnitPrice)}/pz`
                                    : ""}
                                </span>
                              )}
                              {selected.regularPrice && (
                                <span style={styles.discountTag}>
                                  in sconto, invece di {money(selected.regularPrice)}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
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
                    const rowImage = CHAINS.map((c) => item.details?.[c.id]?.imageUrl).find(Boolean);
                    return (
                      <tr key={i} style={excluded ? styles.trExcluded : undefined}>
                        <td style={styles.tdProduct}>
                          <div style={styles.tdProductRow}>
                            {rowImage && <img src={rowImage} alt="" style={styles.thumbSmall} />}
                            <div>
                              {item.name}
                              {excluded && <div style={styles.excludedNote}>escluso dal totale</div>}
                            </div>
                          </div>
                        </td>
                        {CHAINS.map((c) => {
                          const d = item.details?.[c.id];
                          return (
                            <td key={c.id} style={styles.td}>
                              {money(item.prices[c.id])}
                              {item.sizes?.[c.id] && <div style={styles.tdSize}>{item.sizes[c.id]}</div>}
                              {d?.unitPrice && (
                                <div style={styles.tdUnitPrice}>
                                  {money(d.unitPrice.value)}/{d.unitPrice.per}
                                </div>
                              )}
                              {d?.multipack && (
                                <div style={styles.tdMultipack}>⚠ pacco da {d.multipack.count}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={styles.tdTotalLabel}>
                      Totale
                      <div style={styles.totalSubLabel}>solo prodotti in tutti i negozi</div>
                    </td>
                    {CHAINS.map((c) => (
                      <td
                        key={c.id}
                        style={{ ...styles.tdTotal, color: cheapestChain === c.id ? "#7CD98A" : "#E8E6DE" }}
                      >
                        {comparableItems.length > 0 ? money(totals[c.id]) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={styles.tdTotalLabel}>
                      Se fai la spesa lì
                      <div style={styles.totalSubLabel}>tutto quello che c'è, anche se manca altrove</div>
                    </td>
                    {CHAINS.map((c) => (
                      <td key={c.id} style={styles.tdTotalAlt}>
                        {fullCoverage[c.id].count > 0 ? money(fullCoverage[c.id].total) : "—"}
                        <div style={styles.totalCount}>
                          {fullCoverage[c.id].count}/{items.length} prodotti
                        </div>
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
  selTermTitle: { fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 10, color: "#F5F3EA" },
  selRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 0", borderBottom: "1px solid #22221A" },
  thumb: { width: 40, height: 40, borderRadius: 4, objectFit: "cover", background: "#0F0F0B", flexShrink: 0 },
  selRowLabel: { display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, marginBottom: 4 },
  selDetail: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4, fontSize: 10.5, color: "#8C8A80" },
  multipackWarn: { color: "#E0B84D" },
  discountTag: { color: "#7CD98A" },
  selNoneInline: { display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#6B6A63", flex: 1 },
  errorInline: { color: "#E0654D" },
  selectDropdown: { flex: 1, minWidth: 0, padding: "8px 8px", background: "#22221A", border: "1px solid #3A3A30", borderRadius: 4, color: "#E8E6DE", fontSize: 12 },
  chipsRow: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 },
  chip: { display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", background: "#2A2410", border: "1px solid #4A3F1A", borderRadius: 20, color: "#E0B84D", fontSize: 11.5, cursor: "pointer" },
  sortRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
  sortLabel: { fontSize: 12, color: "#8C8A80" },
  sortToggle: { display: "flex", border: "1px solid #3A3A30", borderRadius: 4, overflow: "hidden" },
  sortBtn: { padding: "6px 12px", background: "#22221A", border: "none", color: "#8C8A80", fontSize: 12, cursor: "pointer" },
  sortBtnActive: { background: "#D8232A", color: "#F5F3EA" },
  dietChip: { padding: "6px 12px", background: "#22221A", border: "1px solid #3A3A30", borderRadius: 20, color: "#8C8A80", fontSize: 11.5, cursor: "pointer" },
  dietChipActive: { background: "#16241A", borderColor: "#3F7D5C", color: "#7CD98A" },
  selBrand: { color: "#8C8A80", fontStyle: "italic" },
  selSize: { color: "#6B6A63" },
  selPrice: { fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 },
  dot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  backBtn: { padding: "10px 16px", background: "transparent", border: "1px solid #3A3A30", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: "#E8E6DE" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thProduct: { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #3A3A30", color: "#8C8A80", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  th: { textAlign: "right", padding: "8px 6px", borderBottom: "1px solid #3A3A30", color: "#8C8A80", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  tdProduct: { padding: "10px 6px", borderBottom: "1px solid #22221A" },
  tdProductRow: { display: "flex", alignItems: "center", gap: 8 },
  thumbSmall: { width: 28, height: 28, borderRadius: 4, objectFit: "cover", background: "#0F0F0B", flexShrink: 0 },
  tdUnitPrice: { fontFamily: "'Inter', sans-serif", fontSize: 9.5, color: "#6B6A63", marginTop: 1 },
  tdMultipack: { fontFamily: "'Inter', sans-serif", fontSize: 9.5, color: "#E0B84D", marginTop: 1 },
  td: { padding: "10px 6px", borderBottom: "1px solid #22221A", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" },
  tdSize: { fontFamily: "'Inter', sans-serif", fontSize: 9.5, color: "#6B6A63", marginTop: 1 },
  trExcluded: { opacity: 0.55 },
  excludedNote: { fontSize: 10, color: "#E0B84D", marginTop: 2 },
  tdTotalLabel: { padding: "10px 6px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13 },
  totalSubLabel: { fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 9.5, color: "#8C8A80", marginTop: 2, textTransform: "none" },
  tdTotal: { padding: "10px 6px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 16 },
  tdTotalAlt: { padding: "10px 6px", textAlign: "right", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 14, color: "#C9C7BC" },
  totalCount: { fontFamily: "'Inter', sans-serif", fontSize: 9.5, color: "#6B6A63", marginTop: 2 },
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
