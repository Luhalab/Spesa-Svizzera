# Spesa Svizzera — confronto prezzi Migros / Coop / Denner / Aldi

Progetto Next.js pronto per GitHub + Vercel.

## Cosa fa davvero e cosa è ancora demo

- **Negozi vicini** (`/api/stores`): dati **reali** da OpenStreetMap / Overpass API, nessuna chiave richiesta.
- **Ricerca prodotti** (`/api/search`): tenta di usare **swissgroceries-mcp** (dati reali di Migros/Coop/Denner/Aldi), e torna automaticamente ai dati demo se non è configurato o non è raggiungibile.

## 1. Metti il progetto su GitHub

```bash
cd spesa-svizzera
git init
git add .
git commit -m "Primo commit"
```

Poi crea un repository vuoto su github.com (senza README, senza .gitignore — li hai già) e collega:

```bash
git remote add origin https://github.com/TUO-USERNAME/spesa-svizzera.git
git branch -M main
git push -u origin main
```

## 2. Deploy su Vercel

1. Vai su vercel.com, accedi con il tuo account GitHub
2. "Add New Project" → seleziona il repository `spesa-svizzera`
3. Vercel riconosce automaticamente che è un progetto Next.js — non serve configurare nulla, clicca "Deploy"
4. In 1-2 minuti ottieni un URL pubblico tipo `spesa-svizzera.vercel.app`

Da quel momento ogni `git push` su `main` aggiorna automaticamente l'app online.

## 3. Nota importante sull'integrazione con swissgroceries-mcp

`swissgroceries-mcp` (github.com/nicktcode/swissgroceries-mcp) è un **server MCP**, pensato per essere avviato come processo a sé e interrogato via protocollo MCP — non è una libreria "leggera" da importare in una funzione serverless.

`lib/mcpClient.js` lo avvia con `npx -y @nicktcode/swissgroceries-mcp` e ci parla tramite `@modelcontextprotocol/sdk`. Questo **funziona in locale** (`npm run dev`), ma su Vercel ha due limiti da conoscere:

- Le funzioni serverless di Vercel hanno un timeout e un cold-start: avviare un sotto-processo Node ad ogni richiesta è lento e può superare il timeout sui piani gratuiti.
- Non è garantito che l'ambiente serverless di Vercel permetta di lanciare sotto-processi arbitrari con `npx`.

**Soluzione consigliata**: tieni il frontend (questa app Next.js) su Vercel, ma sposta `/api/search` su un piccolo servizio Node **sempre acceso** (Railway, Render o Fly.io hanno piani gratuiti adatti), che tiene il processo `swissgroceries-mcp` avviato una sola volta e risponde velocemente ad ogni richiesta. Poi nel frontend punti `fetch` a quell'URL invece che a `/api/search` locale.

Se preferisci restare semplice, l'app funziona comunque subito su Vercel usando i **dati demo** come fallback automatico — utile per mostrare l'interfaccia mentre imposti il backend reale con calma.

## 4. Sviluppo locale

```bash
npm install
npm run dev
```

Apri http://localhost:3000
