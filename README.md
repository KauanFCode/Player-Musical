# Player 2.0 (PWA 100% Offline)

Reprodutor de música moderno em formato **PWA (Progressive Web App)**, instalável pelo navegador no Android, iPhone/iPad e PC, com suporte completo offline via **Service Worker** + **IndexedDB** e controles na tela de bloqueio via **Media Session API**.

## Recursos
- **100% Offline:** músicas importadas, músicas baixadas do Audius, capas HD, letras sincronizadas (`.lrc`) e playlists ficam salvos localmente no IndexedDB.
- **Metadados & Capas ID3v2:** extrai título (`TIT2`), artista (`TPE1`), álbum (`TALB`) e capa embutida (`APIC`) diretamente dos arquivos MP3.
- **Letras Sincronizadas (`.lrc`):** rolagem automática com destaque e toque na linha para pular na música.
- **Player Completo:** Shuffle real, Repeat (`off` / `all` / `one`), fila interativa, `-10s` / `+10s`, busca automática de capas (iTunes) e letras (LRCLIB), e aba Explorar (Audius).

## Como testar localmente
```bash
npm install
npm run dev
```

Para testar a versão de produção com Service Worker:
```bash
npm run build
npm run preview
```

## Deploy no GitHub Pages (`KauanFCode/Player-Musical`)
O projeto já está configurado com `base: '/Player-Musical/'`, `.nojekyll` e workflow em `.github/workflows/deploy.yml` para publicar em `https://kauanfcode.github.io/Player-Musical/`.

### Opção 1: Sem instalar Git (upload direto de `dist/` pelo navegador)
1. Abra `https://github.com/KauanFCode/Player-Musical` no navegador.
2. Clique em **uploading an existing file**.
3. Arraste **todo o conteúdo** de `Player-PWA/dist/` para a página e faça o commit na branch `main`.
4. No repositório, vá em **Settings → Pages → Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / `/ (root)` → **Save**.
5. Aguarde ~1 minuto e acesse `https://kauanfcode.github.io/Player-Musical/`.

### Opção 2: Com Git + Deploy Automático (GitHub Actions)
1. Instale o Git (`winget install Git.Git`) e abra um terminal na pasta `Player-PWA`:
   ```powershell
   git init
   git add .
   git commit -m "feat: Player 2.0 PWA"
   git branch -M main
   git remote add origin https://github.com/KauanFCode/Player-Musical.git
   git push -u origin main
   ```
2. No GitHub, vá em **Settings → Pages → Source** e selecione **GitHub Actions**.
3. A cada push na branch `main`, o workflow publica automaticamente em `https://kauanfcode.github.io/Player-Musical/`.

*(Para outro domínio raiz como Netlify Drop ou Vercel, faça o build com `VITE_BASE=./ npm run build`.)*
