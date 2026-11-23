# Wavy (PWA Offline + App Android APK v2.0.8)

Reprodutor de música moderno em duas versões: **PWA 100% Offline** (instalável pelo navegador no Android, iPhone/iPad e PC via **Service Worker** + **IndexedDB**) e **Aplicativo Android Nativo (`.apk`)**.

> [!IMPORTANT]
> **Links Oficiais & Download do APK:**
> - 🌐 **Versão Web / Pasta no cPanel:** https://oficinahotrods.com.br/15987/player/
> - 🚀 **GitHub Pages (PWA):** https://kauanfcode.github.io/Player-Musical/
> - 📱 **Download Direto do APK Android (Wavy v2.0.8):**
>   - Pelo repositório GitHub: [`public/Wavy-v2.0.8.apk`](./public/Wavy-v2.0.8.apk?raw=true)
>   - Pelo GitHub Pages: https://kauanfcode.github.io/Player-Musical/Wavy-v2.0.8.apk
>   - Pelo cPanel: https://oficinahotrods.com.br/15987/player/Wavy-v2.0.8.apk

## Estrutura do Repositório
- `/` (`src/`, `public/`, `dist/`): Código-fonte e build de produção do **Wavy PWA** (inclui `.htaccess` pronto para cPanel e `Wavy-v2.0.8.apk` em `public/` e `dist/`).
- `/native-android/`: Código-fonte **React Native / Android** responsável por gerar o APK `Wavy-v2.0.8.apk`.

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
