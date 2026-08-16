# Spesa Svizzera — confronto prezzi Migros / Coop / Denner / Aldi

Progetto Next.js pronto per GitHub + Vercel.

## Cosa fa davvero e cosa è ancora demo

- **Negozi vicini** (`/api/stores`): dati **reali** da OpenStreetMap / Overpass API, nessuna chiave richiesta.
- **Ricerca prodotti + promozioni** (`/api/search`): usa **swissgroceries-mcp** direttamente da funzione serverless Vercel, senza backend separato — vedi la nota sotto sulla latenza. Torna automaticamente ai dati demo se la ricerca live non risponde in tempo.

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

## 3. Nota sulla latenza (scelta di design)

Per evitare di gestire un servizio separato sempre acceso (Railway/Render), `pages/api/search.js` avvia `swissgroceries-mcp` come sotto-processo **direttamente dentro la funzione Vercel**, ad ogni richiesta. Questo significa:

- Ogni ricerca prodotto può richiedere **qualche secondo** (a volte di più), perché `npx` deve verificare/avviare il pacchetto da zero — non c'è un processo già "caldo" che risponde subito.
- Il piano gratuito (Hobby) di Vercel permette funzioni fino a **60 secondi** (impostato in `pages/api/search.js` con `export const config = { maxDuration: 60 }`); se anche questo non basta, l'app torna automaticamente ai dati demo invece di mostrare un errore.
- Se in futuro la lentezza diventasse un problema, la cartella `backend/` contiene già pronta l'alternativa con un server sempre acceso (vedi commenti nei file) — ma non è necessaria per far funzionare l'app.

## 4. Sviluppo locale

```bash
npm install
npm run dev
```

Apri http://localhost:3000
