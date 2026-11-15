import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { platform, useInstallPrompt } from '../lib/hooks.ts';
import { SITE_URL } from '../lib/site.ts';
import { Card, LinkButton, Page } from '../components/ui.tsx';

/** «Descargar la app»: Qullqa se instala desde el navegador (PWA); las instrucciones cambian según el celular. */
export function DownloadPage() {
  const { canInstall, install, standalone } = useInstallPrompt();
  const p = platform();
  const [qr, setQr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!p.mobile) void QRCode.toDataURL(`${SITE_URL}/descargar`, { width: 480, margin: 1, color: { dark: '#2b201b', light: '#ffffff' } }).then(setQr);
  }, [p.mobile]);

  return (
    <Page title="Descargar la app" back="/">
      <div className="center">
        <img src="/icon-192.png" alt="Ícono de Qullqa" width={96} height={96} style={{ borderRadius: 22, boxShadow: 'var(--shadow)', margin: '6px 0 10px' }} />
        <p className="lead">Instala Qullqa en tu celular: queda con su ícono, se abre como app y ocupa menos de 2 MB. Es gratis.</p>
      </div>

      {standalone || done ? (
        <Card className="ok">
          <p className="success">✓ Qullqa ya está instalada en este celular.</p>
          <LinkButton to="/">Abrir mi inicio</LinkButton>
        </Card>
      ) : canInstall ? (
        <Card className="accent">
          <button onClick={() => void install().then(() => setDone(true))}>Instalar Qullqa</button>
          <p className="small muted center">Te preguntará si quieres agregarla a tu pantalla de inicio.</p>
        </Card>
      ) : p.inApp ? (
        <Card className="accent" title="Abre esta página en tu navegador">
          <p>Estás dentro de otra app (WhatsApp, Facebook…), que no deja instalar.</p>
          <ol className="bullets">
            <li>Toca el menú <strong>⋮</strong> o <strong>···</strong> de arriba.</li>
            <li>Elige <strong>«Abrir en Chrome»</strong>{p.ios ? ' o «Abrir en Safari»' : ' o «Abrir en el navegador»'}.</li>
            <li>Vuelve a tocar «Descargar app».</li>
          </ol>
        </Card>
      ) : p.ios ? (
        <Card className="accent" title="En iPhone (Safari)">
          {!p.iosSafari && <p className="notice">Abre <strong>qullqa.us</strong> en <strong>Safari</strong>: en iPhone solo Safari puede instalarla.</p>}
          <ol className="bullets">
            <li>Toca el botón <strong>Compartir</strong> (el cuadrado con una flecha hacia arriba, abajo en la pantalla).</li>
            <li>Baja y toca <strong>«Agregar a inicio»</strong>.</li>
            <li>Toca <strong>«Agregar»</strong>. Aparecerá el hongo de Qullqa en tu pantalla.</li>
          </ol>
        </Card>
      ) : p.android ? (
        <Card className="accent" title="En Android">
          <ol className="bullets">
            <li>Toca el menú <strong>⋮</strong> (tres puntos, arriba a la derecha){p.samsung ? ' o ☰ abajo' : ''}.</li>
            <li>Toca <strong>«Instalar app»</strong> o <strong>«Agregar a pantalla de inicio»</strong>.</li>
            <li>Confirma con <strong>«Instalar»</strong>. Aparecerá el hongo de Qullqa.</li>
          </ol>
          <p className="small muted">Si no ves la opción, abre <strong>qullqa.us</strong> en <strong>Chrome</strong>.</p>
        </Card>
      ) : (
        <Card className="accent" title="Escanea con tu celular">
          {qr && <div className="invite"><img src={qr} alt="Código QR para abrir qullqa.us/descargar en el celular" /></div>}
          <p className="small center">Abre la cámara del celular, apunta al código y sigue las instrucciones. En la computadora, Chrome o Edge muestran un ícono de instalar en la barra de direcciones.</p>
        </Card>
      )}

      <Card title="Preguntas">
        <p className="small"><strong>¿Está en Play Store?</strong> Todavía no. Se instala desde aquí, es la misma app y se actualiza sola.</p>
        <p className="small"><strong>¿Necesito internet?</strong> Para guardar y ver el plan, sí. La app abre aunque tengas poca señal.</p>
        <p className="small"><strong>¿Ocupa mucho?</strong> No, menos de 2 MB. No pide permisos al instalarse; el GPS y la cámara se piden solo cuando los usas.</p>
      </Card>
    </Page>
  );
}
