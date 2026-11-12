import { z } from "zod";
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingresá un correo válido.")
  .max(254);
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Ingresá tu contraseña.").max(128),
});
export const registerSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá al menos 2 caracteres.").max(100),
  email,
  password: z
    .string()
    .min(10, "Usá al menos 10 caracteres.")
    .max(128, "Usá hasta 128 caracteres."),
});
export const materiaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Ingresá el nombre de la materia.")
    .max(120, "Usá hasta 120 caracteres."),
  descripcion: z.string().trim().max(1000, "Usá hasta 1000 caracteres."),
});
export function fieldErrors(issues: z.core.$ZodIssue[]) {
  return Object.fromEntries(
    issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}
