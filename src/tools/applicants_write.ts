import { z } from "zod";
import { hfRequest } from "../client.js";

// --- Операции ЗАПИСИ по кандидатам ---
// Создание карточки: POST /accounts/{id}/applicants (ApplicantCreateRequest, application/json).
// Привязка к вакансии / постановка на этап: POST /accounts/{id}/applicants/{aid}/vacancy (AddApplicantToVacancyRequest).
// ВАЖНО: POST в client.ts не ретраится намеренно — у HuntFlow нет идемпотентности, повтор создаёт дубль.

// Резюме внутри карточки (externals[]). files — массив ЦЕЛОЧИСЛЕННЫХ ID загруженных файлов
// (из upload_resume → id). Подтверждено живой OpenAPI (ApplicantResumeCreate).
const externalSchema = z.object({
  auth_type: z.string().optional().describe("Тип источника резюме, напр. NATIVE"),
  account_source: z.number().optional().describe("ID источника резюме"),
  files: z.array(z.number()).optional().describe("ID загруженных файлов (из upload_resume → id)"),
  data: z
    .object({ body: z.string().optional().describe("Текст резюме") })
    .optional()
    .describe("Содержимое резюме (например, распознанный текст из upload_resume → text)"),
});

const socialSchema = z.object({
  social_type: z.string().describe("Тип: telegram, skype, и т.п."),
  value: z.string().describe("Значение (ник/идентификатор)"),
});

const siteSchema = z.object({
  site_type: z.string().describe("Тип сайта"),
  value: z.string().describe("URL/значение"),
});

export const createApplicantSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  first_name: z.string().min(1).describe("Имя (обязательно)"),
  last_name: z.string().min(1).describe("Фамилия (обязательно)"),
  middle_name: z.string().optional().describe("Отчество"),
  phone: z.string().optional().describe("Телефон"),
  email: z.string().email().optional().describe("Email"),
  position: z.string().optional().describe("Желаемая должность"),
  company: z.string().optional().describe("Текущая/последняя компания"),
  money: z.string().optional().describe('Зарплатные ожидания строкой, напр. "200000 руб"'),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Дата рождения ISO YYYY-MM-DD (одно поле, НЕ day/month/year)"),
  photo: z.number().optional().describe("ID загруженного фото (из upload_resume → id)"),
  externals: z.array(externalSchema).optional().describe("Резюме кандидата (текст и/или ID файлов)"),
  social: z.array(socialSchema).optional().describe("Соцсети/мессенджеры"),
  site: z.array(siteSchema).optional().describe("Сайты/ссылки"),
});

export async function handleCreateApplicant(
  params: z.infer<typeof createApplicantSchema>,
): Promise<string> {
  const { account_id, ...rest } = params;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) body[key] = value;
  }
  const result = await hfRequest("POST", `/accounts/${account_id}/applicants`, body);
  return JSON.stringify(result, null, 2);
}

export const attachToVacancySchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  applicant_id: z.number().describe("ID кандидата (из create_applicant → id)"),
  vacancy: z.number().describe("ID вакансии (обязательно)"),
  status: z.number().describe("ID этапа воронки из list_stages (обязательно)"),
  comment: z.string().optional().describe("Комментарий к переходу"),
  rejection_reason: z.number().optional().describe("ID причины отказа (list_rejection_reasons) — для этапа отказа"),
  fill_quota: z.number().optional().describe("ID квоты — для этапа найма"),
  employment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Дата выхода на работу YYYY-MM-DD"),
  files: z.array(z.number()).optional().describe("ID прикреплённых файлов"),
});

export async function handleAttachApplicantToVacancy(
  params: z.infer<typeof attachToVacancySchema>,
): Promise<string> {
  const { account_id, applicant_id, ...rest } = params;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) body[key] = value;
  }
  const result = await hfRequest(
    "POST",
    `/accounts/${account_id}/applicants/${applicant_id}/vacancy`,
    body,
  );
  return JSON.stringify(result, null, 2);
}
