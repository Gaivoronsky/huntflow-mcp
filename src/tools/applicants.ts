import { z } from "zod";
import { hfGet } from "../client.js";

// --- Текстовый поиск кандидатов: GET /accounts/{id}/applicants/search (count ≤ 100) ---
// Именно этот эндпоинт реально фильтрует по тексту. Поддерживает page и count до 100.
export const searchApplicantsSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  q: z.string().optional().describe("Строка поиска (имя, email, текст резюме)"),
  field: z
    .enum(["all", "education", "experience", "position"])
    .default("all")
    .describe("Где искать: all | education | experience | position"),
  status: z.array(z.number()).optional().describe("Фильтр по ID статусов (этапов)"),
  vacancy: z.array(z.number()).optional().describe("Фильтр по ID вакансий"),
  count: z.number().int().min(1).max(100).default(30).describe("Кол-во на странице (макс 100)"),
  page: z.number().int().min(1).default(1).describe("Номер страницы (нумерация с 1)"),
});

export async function handleSearchApplicants(params: z.infer<typeof searchApplicantsSchema>): Promise<string> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  query.set("field", params.field);
  query.set("count", String(params.count));
  query.set("page", String(params.page));
  for (const s of params.status ?? []) query.append("status", String(s));
  for (const v of params.vacancy ?? []) query.append("vacancy", String(v));
  const result = await hfGet(`/accounts/${params.account_id}/applicants/search?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}

// --- Листинг кандидатов с фильтром по вакансии/статусу: GET /accounts/{id}/applicants (count ≤ 30) ---
// Нативно отдаёт кандидатов конкретной вакансии/этапа без выгрузки всей базы.
export const listApplicantsSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  vacancy: z.number().optional().describe("Фильтр по ID вакансии"),
  status: z
    .number()
    .optional()
    .describe("Фильтр по ID статуса (этапа). Нельзя одновременно с agreement_state"),
  agreement_state: z
    .enum(["not_sent", "sent", "accepted", "declined"])
    .optional()
    .describe("Фильтр по согласию на обработку ПДн. Нельзя одновременно со status"),
  count: z.number().int().min(1).max(30).default(30).describe("Кол-во на странице (макс 30)"),
  page: z.number().int().min(1).default(1).describe("Номер страницы (нумерация с 1)"),
});

export async function handleListApplicants(params: z.infer<typeof listApplicantsSchema>): Promise<string> {
  const query = new URLSearchParams();
  if (params.vacancy !== undefined) query.set("vacancy", String(params.vacancy));
  if (params.status !== undefined) query.set("status", String(params.status));
  if (params.agreement_state) query.set("agreement_state", params.agreement_state);
  query.set("count", String(params.count));
  query.set("page", String(params.page));
  const result = await hfGet(`/accounts/${params.account_id}/applicants?${query.toString()}`);
  return JSON.stringify(result, null, 2);
}

export const getApplicantSchema = z.object({
  account_id: z.number().describe("ID аккаунта"),
  applicant_id: z.number().describe("ID кандидата"),
});

export async function handleGetApplicant(params: z.infer<typeof getApplicantSchema>): Promise<string> {
  const result = await hfGet(`/accounts/${params.account_id}/applicants/${params.applicant_id}`);
  return JSON.stringify(result, null, 2);
}
