import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.ts';

/** GET sencillo con recarga manual. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Guarda el evento de instalación aunque llegue antes de montar React. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const early = window as Window & { __qullqaInstall?: InstallEvent | null };
let deferred: InstallEvent | null = early.__qullqaInstall ?? null;
const listeners = new Set<() => void>();
// index.html captura el evento lo antes posible; aquí solo lo recogemos
window.addEventListener('qullqa-installable', () => {
  deferred = early.__qullqaInstall ?? null;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  early.__qullqaInstall = null;
  listeners.forEach((l) => l());
});

/** Qué celular/navegador es, para dar las instrucciones correctas de instalación. */
export function platform() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  // Navegadores dentro de otras apps: no permiten instalar
  const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|TikTok|; wv\)/i.test(ua);
  const iosSafari = ios && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua) && !inApp;
  const samsung = /SamsungBrowser/i.test(ua);
  return { ios, android, inApp, iosSafari, samsung, mobile: ios || android };
}

export function useInstallPrompt() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return {
    canInstall: !!deferred && !standalone,
    standalone,
    install: async () => {
      if (!deferred) return false;
      const ev = deferred;
      deferred = null;
      early.__qullqaInstall = null;
      await ev.prompt();
      const choice = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }));
      force((n) => n + 1);
      return choice.outcome === 'accepted';
    },
  };
}
