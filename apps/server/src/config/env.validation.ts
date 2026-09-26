import { z } from 'zod';

// Variables de entorno validadas al arrancar: una variable mal puesta falla aquí,
// con un mensaje claro, y no a mitad de una petición. Una variable nueva se añade
// a este schema Y a `.env.example`.
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8082),
  LOG_LEVEL: z.string().default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),

  // Identidad. false = seam de desarrollo (cabecera X-Team-Email).
  AUTH_ENABLED: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
  TEAM_EMAIL_DOMAIN: z.string().min(1).default('example.com'),

  // Clave compartida de los jobs (POST /api/v1/jobs/*).
  JOBS_API_KEY: z.string().min(8, 'JOBS_API_KEY debe tener al menos 8 caracteres'),
});

export type EnvVars = z.infer<typeof EnvSchema>;

export function validateEnv(raw: NodeJS.ProcessEnv): EnvVars {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
    throw new Error(`Configuración inválida:\n  ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.AUTH_ENABLED) {
    // Falla cerrado: el seam de cabeceras nunca debe llegar a producción.
    throw new Error('AUTH_ENABLED=false no está permitido en producción');
  }
  return parsed.data;
}
