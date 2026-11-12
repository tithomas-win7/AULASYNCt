import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = resolve(root, ".local/pgdata");
const bin = resolve(root, ".local/postgresql/pgsql/bin/pg_ctl.exe");
const action = process.argv[2];
if (!["start", "stop", "status"].includes(action)) {
  console.error("Usar: node scripts/postgres-local.mjs start|stop|status");
  process.exit(1);
}
if (
  !existsSync(bin) ||
  !existsSync(resolve(data, "PG_VERSION")) ||
  readFileSync(resolve(data, "PG_VERSION"), "utf8").trim() !== "17"
) {
  console.error("No se encontro el cluster PostgreSQL 17 local de AulaSync.");
  process.exit(1);
}
const run = (args) =>
  spawnSync(bin, ["-D", data, ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    stdio: "ignore",
  });
const status = run(["status"]);
if (action === "status") {
  console.log(
    status.status === 0
      ? "PostgreSQL local iniciado."
      : status.status === 3
        ? "PostgreSQL local detenido."
        : "Estado PostgreSQL no disponible.",
  );
  process.exit(status.status === 0 || status.status === 3 ? 0 : 1);
}
if (action === "start" && status.status === 0) {
  console.log("PostgreSQL local ya esta iniciado.");
  process.exit(0);
}
if (status.status !== 0 && status.status !== 3) {
  console.error("No se pudo verificar el cluster; no se modifica su estado.");
  process.exit(1);
}
if (action === "stop" && status.status === 3) {
  console.log("PostgreSQL local ya esta detenido.");
  process.exit(0);
}
const args =
  action === "start"
    ? ["-l", resolve(root, ".local/postgres-startup.log"), "-w", "start"]
    : ["-m", "fast", "-w", "stop"];
const result = run(args);
if (result.status !== 0) {
  console.error(
    "No se pudo completar la operacion. Revisar .local/postgres-startup.log sin modificar Windows.",
  );
  process.exit(1);
}
console.log(
  action === "start"
    ? "PostgreSQL local iniciado."
    : "PostgreSQL local detenido; los datos se conservan.",
);
