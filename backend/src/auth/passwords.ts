import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";

function derive(password: string, salt: string, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    nodeScrypt(
      password,
      salt,
      64,
      { N: cost, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 32768);
  return ["scrypt", "32768", "8", "1", salt, key.toString("hex")].join("$");
}
export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, cost, r, p, salt, key, extra] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !["16384", "32768"].includes(cost) ||
    r !== "8" ||
    p !== "1" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(key ?? "") ||
    extra !== undefined
  )
    return false;
  const actual = await derive(password, salt, Number(cost));
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}
// Permite una verificación costosa también cuando el correo no existe.
export const dummyPasswordHash = hashPassword(randomBytes(32).toString("hex"));
