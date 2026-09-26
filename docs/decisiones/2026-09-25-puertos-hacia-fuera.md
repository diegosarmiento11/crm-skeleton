# 2026-09-25 · Tres puertos: identidad, CRM y notificaciones

**Decisión.** El CRM no conoce el proveedor de identidad, el canal de notificaciones ni a los
módulos que lo consumen. Habla con ellos por interfaces:
`IdentityProvider` (auth), `CrmPort` (hacia otros módulos), `NotifierPort` (avisos).

**Por qué.** El repositorio del que se extrajo este CRM lo tenía acoplado a Firebase, a un inbox
omnicanal y a Google Chat; sacarlo costó quitar referencias cruzadas una a una. Los puertos son
baratos de mantener y hacen posible: cambiar de proveedor de identidad sin tocar controladores,
mover el CRM a su propio servicio implementando `CrmPort` con HTTP, y enchufar Slack o correo
sin tocar `comments/`.

**Alternativa descartada.** Inyectar directamente los SDK (Firebase Admin, cliente de chat) en
los servicios. Más corto al principio; cada integración nueva vuelve a tocar el núcleo.
