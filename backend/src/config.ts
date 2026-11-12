import { z } from "zod";

const baseSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});
const runtimeSchema = baseSchema.extend({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z
    .string()
    .url()
    .default("http://127.0.0.1:5173")
    .refine((value) => new URL(value).origin === value),
  AI_PROVIDER: z
    .enum(["disabled", "mock", "ollama", "openai-compatible"])
    .optional(),
  AI_BASE_URL: z.string().url().optional(),
  AI_MODEL: z.string().trim().min(1).optional(),
  AI_API_KEY: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24).default(8),
});
const configuredRuntime = runtimeSchema.superRefine((value, ctx) => {
  const target = URL.canParse(value.DATABASE_URL)
    ? new URL(value.DATABASE_URL)
    : undefined;
  const testing = value.NODE_ENV === "test";
  if (
    !target ||
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    target.pathname !== (testing ? "/aulasync_test" : "/aulasync_dev") ||
    (testing && target.username !== "aulasync_test_app")
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: testing
        ? "Las pruebas requieren aulasync_test local y su rol exclusivo."
        : "Se requiere aulasync_dev local.",
    });
  }
  if (value.NODE_ENV === "production" && value.AI_PROVIDER === "mock") {
    ctx.addIssue({
      code: "custom",
      path: ["AI_PROVIDER"],
      message: "La simulación solo está disponible en desarrollo y pruebas.",
    });
  }
  if (value.AI_PROVIDER === "ollama") {
    const url = value.AI_BASE_URL ? new URL(value.AI_BASE_URL) : undefined;
    if (
      !url ||
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      url.pathname !== "/" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !value.AI_MODEL ||
      value.AI_MODEL.endsWith("-cloud") ||
      value.AI_MODEL.endsWith(":cloud")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_PROVIDER"],
        message: "Ollama requiere una URL HTTP en 127.0.0.1 y un modelo local.",
      });
    }
  }
  if (value.AI_PROVIDER === "openai-compatible") {
    const url = value.AI_BASE_URL ? new URL(value.AI_BASE_URL) : undefined;
    if (
      url?.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !value.AI_MODEL ||
      !value.AI_API_KEY
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AI_PROVIDER"],
        message: "Configurá URL HTTPS, modelo y clave del proveedor.",
      });
    }
  }
});
export type RuntimeConfig = z.infer<typeof runtimeSchema>;
export function parseEnvironment(input: NodeJS.ProcessEnv) {
  return baseSchema.parse(input);
}
export function parseRuntimeEnvironment(input: NodeJS.ProcessEnv) {
  return configuredRuntime.parse({
    ...input,
    AI_PROVIDER: input.AI_PROVIDER?.trim() || undefined,
    AI_BASE_URL: input.AI_BASE_URL?.trim() || undefined,
    AI_MODEL: input.AI_MODEL?.trim() || undefined,
  });
}
