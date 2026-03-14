# Ricettario Piccotti

Sito statico pronto per GitHub Pages.

## Pubblicazione
1. Carica tutti i file di questa cartella nel repository GitHub.
2. In GitHub vai su **Settings → Pages**.
3. In **Build and deployment**, scegli:
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/ (root)`
4. Salva.

L'URL provvisorio sarà:
`https://7jkdqgyb6w-crypto.github.io/Ricettario/`

## Struttura
- `index.html` → home del ricettario
- `ricette/` → pagine delle ricette
- `indici/` → indici ingredienti, geografia, tecniche, fonti
- `contenuti/` → markdown sorgente e indici
- `foto/feed/` → cartelle previste per le immagini

## Foto
Le immagini vanno collocate in:
`foto/feed/<slug>/01.jpg`
`foto/feed/<slug>/02.jpg`

Nel file `PHOTO-MANIFEST.*` trovi l'elenco delle cartelle foto previste.
