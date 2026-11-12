import "dotenv/config";
import { createApp } from "./app.js";
import { parseRuntimeEnvironment } from "./config.js";
import { createDatabase } from "./db.js";

async function main() {
  const config = parseRuntimeEnvironment(process.env);
  const db = createDatabase(config);
  await db.$connect();
  const server = createApp({ db, config }).listen(
    config.PORT,
    "127.0.0.1",
    () => {
      console.info(`AulaSync API: http://127.0.0.1:${config.PORT}/api/health`);
    },
  );
  let closing = false;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      if (closing) return;
      closing = true;
      server.close(() => {
        void db.$disconnect().finally(() => process.exit(0));
      });
    });
  }
}
main().catch(() => {
  console.error(
    "No se pudo iniciar AulaSync. Revisá PostgreSQL y las variables de entorno sin publicar sus valores.",
  );
  process.exitCode = 1;
});
