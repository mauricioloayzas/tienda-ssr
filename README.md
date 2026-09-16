# Clichín — Tienda SSR

SSR público (sin login) para que los clientes de un negocio en Clichín (con el add-on
`tienda_publica` activo) compren sus productos: `/tienda/{url_name}`. Calcado directo de
`caja-registradora/booking-ssr` — mismo stack, mismo patrón de deploy, mismo criterio de
reusar los backends existentes vía endpoints `/public/...` nuevos.

## Arquitectura

```
tienda.clichin.app/tienda/{slug}  →  API Gateway (HTTP API)  →  Lambda (este proyecto)
                                                                       ↓
                                                Nuxt SSR renderiza el HTML (lee el slug de la ruta)
                                                                       ↓
                                    Llama a los endpoints /public/... de auth (perfil),
                                    apotheca (catálogo + pedido) y collector (pago) —
                                    mismos backends que ya usa el admin
                                                                       ↓
                                              Assets estáticos (JS/CSS): bucket S3 dedicado
```

No hay backend propio. El flujo de compra:

1. Catálogo público de productos (`GET /public/profiles/{id}/productos`, apotheca) —
   solo tangibles activos con stock > 0.
2. Carrito en el cliente (sin persistir hasta confirmar).
3. `POST /public/profiles/{id}/orders` (apotheca) crea el pedido en "pendiente",
   revalidando precio y stock contra el catálogo actual.
4. Pago: mismos endpoints públicos que ya usa `booking-ssr` (`GET .../payment-methods`,
   `POST .../payment-methods/{id}/prepare`, `POST /public/transactions/{id}/comprobante`
   — collector).
5. `PATCH /public/orders/{id}/transaction` (apotheca) vincula la transacción y — solo para
   pago con tarjeta confirmado — dispara la factura automática hacia caja-registradora
   (`internal/facturas-desde-order`), que a su vez descuenta stock y postea el asiento
   contable automáticamente si el negocio tiene contabilidad activa (mismo mecanismo ya
   usado por facturas manuales con línea de producto — sin código nuevo ahí).

## Cómo apuntar `clichin.com`/`tienda.clichin.app` a este Lambda

Este `serverless.yml` mapea `tienda.clichin.app` como dominio custom de su propio API Gateway
HTTP API (certificado ACM `arn:aws:acm:us-east-1:996197173188:certificate/08e464da-3f3a-4b7c-916c-78d991441d6c`,
ya solicitado y con el registro de validación DNS creado en el hosted zone de Route53 de
`clichin.app`). Dev sigue usando únicamente la URL cruda de `execute-api`.

## Deploy

```bash
cp .env.example .env   # completar con las URLs reales de los backends + site key de reCAPTCHA

npm install
npm run deploy:dev     # build + sync de assets a S3 + sls deploy --stage dev
npm run deploy:prod
```

El primer deploy crea el bucket S3 de assets (`clichin-tienda-assets-{stage}`) vía CloudFormation.

## SEO

- Cada página `/tienda/{slug}` genera `<title>`, meta description, Open Graph, `rel=canonical`
  y JSON-LD (`Store`) específicos del negocio, renderizados server-side.
- `/robots.txt` y `/sitemap.xml` son rutas dinámicas (`server/routes/`).
