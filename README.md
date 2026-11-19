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
