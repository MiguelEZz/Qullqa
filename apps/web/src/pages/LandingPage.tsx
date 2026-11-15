import { Card, LinkButton, Page } from '../components/ui.tsx';

/** Portada para quien aún no inició sesión. */
export function LandingPage() {
  return (
    <Page title="Qullqa" hideTitle>
      <section className="hero">
        <img className="mark" src="/hongo.png" alt="" width={96} height={93} />
        <h1>Decidamos juntos qué sembrar</h1>
        <p>
          Qullqa junta los datos de clima y satélite de la NASA con lo que cada familia ve en su chacra, para que la comunidad elija qué
          sembrar, cuándo y con quién — y nadie salga perdiendo.
        </p>
        <LinkButton to="/ingresar">Crear mi cuenta gratis</LinkButton>
        <LinkButton to="/ingresar?modo=ingresar" variant="secondary">Ya tengo cuenta</LinkButton>
      </section>

      <Card title="Cómo funciona">
        <ol className="steps">
          <li><strong>Busca tu comunidad</strong><span>Yanque, Chivay, Coporaque… La forman los vecinos que se unen.</span></li>
          <li><strong>Marca tus parcelas</strong><span>Camina el borde con el GPS o dibújalo en el mapa. Cuenta qué sembraste.</span></li>
          <li><strong>Reparte tus 10 monedas</strong><span>Dinos qué te importa más: agua, ingreso, suelo, forraje… Es privado.</span></li>
          <li><strong>Recibe tu plan</strong><span>Tu rotación actual, tu mejor plan solo y el plan coordinado, con cuánto ganas.</span></li>
        </ol>
      </Card>

      <Card title="Con datos que se pueden revisar">
        <p className="small">
          44 años de clima diario (NASA POWER), lluvia satelital (GPM IMERG), vegetación y temperatura de los andenes (MODIS), relieve (SRTM) y
          suelos (SoilGrids, ISRIC). Cada número dice de dónde viene y si es medido, estimado, simulado o un supuesto.
        </p>
      </Card>
    </Page>
  );
}
