import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { hfUpload } from "../client.js";

// Загрузка файла резюме: POST /accounts/{id}/upload (multipart/form-data, поле file).
// Заголовок X-File-Parse: true включает распознавание CV — ответ содержит text/fields/photo
// и id файла, который кладётся в create_applicant → externals[].files / photo.
// Источник файла: либо локальный путь (file_path, сервер читает байты), либо base64 (content_base64).
export const uploadResumeSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  file_path: z
    .string()
    .optional()
    .describe("Локальный путь к файлу (сервер прочитает байты). Либо используйте content_base64"),
  content_base64: z
    .string()
    .optional()
    .describe("Содержимое файла в base64 (альтернатива file_path). Требует file_name"),
  file_name: z
    .string()
    .optional()
    .describe("Имя файла для content_base64 (напр. resume.pdf). Для file_path берётся из пути"),
  content_type: z
    .string()
    .optional()
    .describe("MIME-тип (напр. application/pdf). По умолчанию application/octet-stream"),
  parse: z
    .boolean()
    .default(true)
    .describe("Распознать резюме (X-File-Parse). Вернёт text/fields/photo для заполнения карточки"),
});

export async function handleUploadResume(
  params: z.infer<typeof uploadResumeSchema>,
): Promise<string> {
  // .shape нужен для server.tool(), поэтому cross-field валидацию делаем здесь, а не через .refine().
  const hasPath = Boolean(params.file_path);
  const hasBase64 = Boolean(params.content_base64);
  if (hasPath === hasBase64) {
    throw new Error("upload_resume: укажите ровно один источник файла — file_path ИЛИ content_base64.");
  }
  if (hasBase64 && !params.file_name) {
    throw new Error("upload_resume: для content_base64 обязателен file_name.");
  }

  let bytes: Uint8Array;
  let filename: string;
  if (params.file_path) {
    bytes = await readFile(params.file_path);
    filename = params.file_name || basename(params.file_path);
  } else {
    bytes = Buffer.from(params.content_base64 as string, "base64");
    filename = params.file_name as string;
  }

  const parse = params.parse ?? true;
  const result = await hfUpload(`/accounts/${params.account_id}/upload`, bytes, filename, {
    parse,
    contentType: params.content_type,
  });
  return JSON.stringify(result, null, 2);
}
