import { z } from 'zod';

// Configuración de tabla por usuario (orden, anchos y visibilidad de columnas).
// Se guarda en el servidor por (usuario, entidad) para que siga al usuario entre
// dispositivos. `passthrough` porque cada tabla puede añadir claves propias.
export const ViewPrefConfigSchema = z
  .object({
    order: z.array(z.string()).optional(), // ids de columna en orden (la primera queda fija)
    widths: z.record(z.number()).optional(), // id de columna → ancho en px
    hidden: z.array(z.string()).optional(), // ids ocultos
  })
  .passthrough();
export type ViewPrefConfig = z.infer<typeof ViewPrefConfigSchema>;

export const ViewPrefSchema = z.object({
  entity: z.string(),
  config: ViewPrefConfigSchema.nullable(),
});
export type ViewPref = z.infer<typeof ViewPrefSchema>;

export const SaveViewPrefSchema = z.object({ config: ViewPrefConfigSchema });
export type SaveViewPrefInput = z.infer<typeof SaveViewPrefSchema>;
