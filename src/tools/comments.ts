import { z } from "zod";
import { hfGet, hfRequest } from "../client.js";

// Комментарии о кандидате — это записи журнала /logs с type=COMMENT.
// Чтение: GET /logs. Создание: POST /logs. Редактирования/удаления в API v2 нет.

export const listApplicantCommentsSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  applicant_id: z.number().describe("ID кандидата"),
  all_types: z
    .boolean()
    .default(false)
    .describe("Показать все типы записей журнала. По умолчанию только комментарии (type=COMMENT)"),
  vacancy: z.number().optional().describe("Фильтр по ID вакансии (нельзя одновременно с personal)"),
  personal: z
    .boolean()
    .optional()
    .describe("Только личные заметки, не привязанные к вакансии (нельзя одновременно с vacancy)"),
  count: z.number().int().min(1).max(100).default(30).describe("Кол-во на странице (макс 100)"),
  page: z.number().int().min(1).default(1).describe("Номер страницы (нумерация с 1)"),
});

export async function handleListApplicantComments(
  params: z.infer<typeof listApplicantCommentsSchema>,
): Promise<string> {
  const query = new URLSearchParams();
  if (!params.all_types) query.append("type", "COMMENT");
  if (params.vacancy !== undefined) query.set("vacancy", String(params.vacancy));
  if (params.personal !== undefined) query.set("personal", String(params.personal));
  query.set("count", String(params.count));
  query.set("page", String(params.page));
  const result = await hfGet(
    `/accounts/${params.account_id}/applicants/${params.applicant_id}/logs?${query.toString()}`,
  );
  return JSON.stringify(result, null, 2);
}

export const addApplicantCommentSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  applicant_id: z.number().describe("ID кандидата"),
  comment: z.string().min(1).max(65535).describe("Текст комментария"),
  vacancy: z.number().optional().describe("Привязать комментарий к вакансии (ID). Без него — личная заметка"),
});

export async function handleAddApplicantComment(
  params: z.infer<typeof addApplicantCommentSchema>,
): Promise<string> {
  const body: Record<string, unknown> = { comment: params.comment };
  if (params.vacancy !== undefined) body.vacancy = params.vacancy;
  const result = await hfRequest(
    "POST",
    `/accounts/${params.account_id}/applicants/${params.applicant_id}/logs`,
    body,
  );
  return JSON.stringify(result, null, 2);
}
