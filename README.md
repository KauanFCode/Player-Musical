# Player 2.0 (PWA Offline + App Android APK v2.0.7)

Reprodutor de música moderno em duas versões: **PWA 100% Offline** (instalável pelo navegador no Android, iPhone/iPad e PC via **Service Worker** + **IndexedDB**) e **Aplicativo Android Nativo (`.apk`)**.

> [!IMPORTANT]
> **Links Oficiais & Download do APK:**
> - 🌐 **Versão Web / Pasta no cPanel:** https://oficinahotrods.com.br/15987/player/
> - 🚀 **GitHub Pages (PWA):** https://kauanfcode.github.io/Player-Musical/
> - 📱 **Download Direto do APK Android (v2.0.7):**
>   - Pelo repositório GitHub: [`public/Player-v2.0.7.apk`](./public/Player-v2.0.7.apk?raw=true)
>   - Pelo GitHub Pages: https://kauanfcode.github.io/Player-Musical/Player-v2.0.7.apk
>   - Pelo cPanel: https://oficinahotrods.com.br/15987/player/Player-v2.0.7.apk

## Estrutura do Repositório
- `/` (`src/`, `public/`, `dist/`): Código-fonte e build de produção do **Player 2.0 PWA** (inclui `.htaccess` pronto para cPanel e `Player-v2.0.7.apk` em `public/` e `dist/`).
- `/native-android/`: Código-fonte **React Native / Android** responsável por gerar o APK `Player-v2.0.7.apk`.

## Como testar o PWA localmente
```bash
npm install
npm run dev
```

Para gerar a versão de produção com Service Worker:
```bash
npm run build
npm run preview
```
