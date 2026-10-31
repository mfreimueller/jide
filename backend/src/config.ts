// Read lazily so tests can change process.env between files.
export function config() {
  const env = process.env;
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL ?? 'mysql://jide:jide@localhost:3307/jide',
    testAdminUrl: env.TEST_DATABASE_ADMIN_URL ?? 'mysql://root:rootpassword@localhost:3307/mysql',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    publicTeacherUrl: env.PUBLIC_TEACHER_URL ?? 'http://localhost:5174',
    smtp: {
      host: env.SMTP_HOST ?? '',
      port: Number(env.SMTP_PORT ?? 587),
      user: env.SMTP_USER ?? '',
      pass: env.SMTP_PASS ?? '',
      from: env.SMTP_FROM ?? 'noreply@localhost',
    },
  };
}
