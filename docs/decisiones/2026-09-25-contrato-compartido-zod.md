# 2026-09-25 · Un solo contrato Zod compartido entre servidor y cliente

**Decisión.** Los schemas de request/response viven en `packages/shared` y se usan tal cual en
los dos lados: el servidor con `createZodDto(Schema)` + `ZodValidationPipe`, el cliente con
`zodResolver(Schema)` y los tipos inferidos.

**Alternativas descartadas.**
- *DTOs con class-validator en el servidor y tipos a mano en el cliente.* Dos definiciones del
  mismo campo se separan con el tiempo; el error típico ("opcional aquí, obligatorio allá") no
  se ve hasta producción.
- *OpenAPI generado desde el servidor y cliente generado.* Vale la pena cuando hay varios
  consumidores externos; para un cliente propio añade un paso de generación sin quitar la doble
  definición del lado del servidor.

**Consecuencia que hay que recordar.** El servidor consume `dist`: tras tocar `shared` hay que
compilarlo. El hook de verificación lo hace solo cuando el turno tocó ese paquete.
