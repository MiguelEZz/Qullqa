/**
 * Cliente de la API. Siempre rutas relativas (/api/...): la app y la API comparten origen.
 * El header evita la página de advertencia de ngrok gratis en las llamadas fetch.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'ngrok-skip-browser-warning': '1', 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}
