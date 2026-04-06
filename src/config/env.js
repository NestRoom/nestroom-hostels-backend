const z = require('zod');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().url().optional(),
  MONGODB_URI: z.string().min(1).optional(),
  DB_NAME: z.string().min(1).default('nestroom')
});

function getEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten();
    const err = new Error('Invalid environment variables');
    err.details = details;
    throw err;
  }
  return parsed.data;
}

module.exports = { getEnv };

