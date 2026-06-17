#!/usr/bin/env node

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { listVacanciesSchema, handleListVacancies, getVacancySchema, handleGetVacancy } from "./tools/vacancies.js";
import {
  searchApplicantsSchema,
  handleSearchApplicants,
  listApplicantsSchema,
  handleListApplicants,
  getApplicantSchema,
  handleGetApplicant,
} from "./tools/applicants.js";
import { getApplicantResumeSchema, handleGetApplicantResume } from "./tools/resumes.js";
import { listStagesSchema, handleListStages } from "./tools/stages.js";
import { listRejectionReasonsSchema, handleListRejectionReasons } from "./tools/rejection_reasons.js";
import {
  listApplicantCommentsSchema,
  handleListApplicantComments,
  addApplicantCommentSchema,
  handleAddApplicantComment,
} from "./tools/comments.js";
import { listAccountsSchema, handleListAccounts } from "./tools/accounts.js";
import {
  createApplicantSchema,
  handleCreateApplicant,
  attachToVacancySchema,
  handleAttachApplicantToVacancy,
} from "./tools/applicants_write.js";
import { uploadResumeSchema, handleUploadResume } from "./tools/uploads.js";

const VERSION = "1.5.0";
const TOOL_COUNT = 14;
const PROMPT_COUNT = 3;

export function createServer(): McpServer {
  const server = new McpServer({ name: "huntflow-mcp", version: VERSION });

  // --- Tools (14) ---

  server.tool("list_accounts", "Список доступных аккаунтов HuntFlow.", listAccountsSchema.shape,
    async () => ({ content: [{ type: "text", text: await handleListAccounts() }] }));

  server.tool("list_vacancies", "Список вакансий (open/all), с пагинацией.", listVacanciesSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListVacancies(params) }] }));

  server.tool("get_vacancy", "Полная информация о вакансии.", getVacancySchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetVacancy(params) }] }));

  server.tool(
    "list_applicants",
    "Кандидаты аккаунта с фильтром по вакансии и/или статусу (этапу). Пагинация: page, count≤30. Для «кандидаты на вакансию X» передайте vacancy.",
    listApplicantsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListApplicants(params) }] }));

  server.tool(
    "search_applicants",
    "Текстовый поиск кандидатов (имя/email/резюме). Пагинация: page, count≤100. Параметр q реально фильтрует.",
    searchApplicantsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleSearchApplicants(params) }] }));

  server.tool("get_applicant", "Полная карточка кандидата (external[], links[]).", getApplicantSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetApplicant(params) }] }));

  server.tool(
    "get_applicant_resume",
    "Резюме (CV) кандидата с телом. external_id берётся из get_applicant → external[].id.",
    getApplicantResumeSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetApplicantResume(params) }] }));

  server.tool("list_stages", "Этапы воронки подбора (статусы вакансии): код → название.", listStagesSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListStages(params) }] }));

  server.tool("list_rejection_reasons", "Справочник причин отказа: код → название.", listRejectionReasonsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListRejectionReasons(params) }] }));

  server.tool(
    "list_applicant_comments",
    "Комментарии о кандидате (журнал, по умолчанию только type=COMMENT). Пагинация page/count≤100.",
    listApplicantCommentsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListApplicantComments(params) }] }));

  server.tool(
    "add_applicant_comment",
    "Добавить комментарий кандидату (операция ЗАПИСИ: создаёт запись в журнале; отредактировать/удалить через API нельзя).",
    addApplicantCommentSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleAddApplicantComment(params) }] }));

  server.tool(
    "create_applicant",
    "Создать карточку кандидата (операция ЗАПИСИ: POST /applicants). Обязательны first_name+last_name. Резюме — текстом (externals[].data.body) и/или ID файлов из upload_resume. Повтор создаёт ДУБЛЬ (нет идемпотентности) — в ответе смотрите doubles[].",
    createApplicantSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleCreateApplicant(params) }] }));

  server.tool(
    "attach_applicant_to_vacancy",
    "Привязать кандидата к вакансии и поставить на этап воронки (операция ЗАПИСИ). Обязательны vacancy + status (ID этапа из list_stages). Для отказа — rejection_reason; для найма — fill_quota + employment_date.",
    attachToVacancySchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleAttachApplicantToVacancy(params) }] }));

  server.tool(
    "upload_resume",
    "Загрузить файл резюме (операция ЗАПИСИ: multipart). Источник: file_path (локальный путь) ИЛИ content_base64+file_name. parse=true распознаёт CV (вернёт text/fields/photo). id из ответа кладите в create_applicant → externals[].files / photo.",
    uploadResumeSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleUploadResume(params) }] }));

  // --- Skills / Prompts (3) ---

  server.prompt("skill-applicants", "Кандидаты на вакансию — показать всех кандидатов, прикреплённых к указанной вакансии.",
    { account_id: z.string().describe("ID аккаунта"), vacancy_id: z.string().describe("ID вакансии") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Покажи всех кандидатов на вакансию ${args.vacancy_id} в аккаунте ${args.account_id}.`,
            `Используй list_applicants (account_id=${args.account_id}, vacancy=${args.vacancy_id}); при необходимости листай страницы через page.`,
            `Расшифруй этапы через list_stages (account_id=${args.account_id}).`,
            `Для каждого кандидата покажи: имя, email, телефон, текущий этап.`,
            `Формат: таблица. В конце — сводка: сколько всего, сколько на каждом этапе.`,
          ].join("\n"),
        },
      }],
    })
  );

  server.prompt("skill-vacancy-stats", "Статистика по вакансии — воронка, сроки, конверсия.",
    { account_id: z.string().describe("ID аккаунта"), vacancy_id: z.string().describe("ID вакансии") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Покажи статистику по вакансии ${args.vacancy_id} в аккаунте ${args.account_id}.`,
            `Используй инструменты: get_vacancy, list_stages, list_applicants (vacancy=${args.vacancy_id}, листай page до конца).`,
            `Собери: название вакансии, дата создания, сколько дней открыта,`,
            `количество кандидатов на каждом этапе воронки, общая конверсия.`,
            `Формат: сначала карточка вакансии, потом воронка (этап -> кол-во), потом выводы.`,
          ].join("\n"),
        },
      }],
    })
  );

  server.prompt("skill-vacancy-analytics", "Аналитика по вакансии: дни в работе, кандидаты на этапах с заказчиком, сроки отправки CV клиенту.",
    { account_id: z.string().describe("ID аккаунта"), vacancy_id: z.string().describe("ID вакансии") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Собери аналитику по вакансии ${args.vacancy_id} в аккаунте ${args.account_id}. Для сроков используй сегодняшнюю дату.`,
            ``,
            `1) Дни в работе: get_vacancy (account_id=${args.account_id}, vacancy_id=${args.vacancy_id}) → возьми position и created. created = начало работы по вакансии. Метрика: сегодня − created в календарных днях.`,
            ``,
            `2) Карта этапов: list_stages (account_id=${args.account_id}). Определи по названиям:`,
            `   - этапы «с заказчиком» — содержат заказчик/клиент/client/customer/hiring manager;`,
            `   - этап «CV отправлено клиенту» — вроде «отправлен(о) заказчику/клиенту», «CV sent», «представлен клиенту», «submitted to client».`,
            `   Если однозначно определить нельзя — покажи список этапов и СПРОСИ у пользователя, какие считать «с заказчиком» и какой = «CV отправлено», прежде чем продолжать.`,
            ``,
            `3) Кандидаты на этапах с заказчиком: list_applicants (account_id=${args.account_id}, vacancy=${args.vacancy_id}, count=30, page=1), затем листай page до total_pages. У каждого кандидата возьми из links[] звено с vacancy=${args.vacancy_id} → его status (текущий этап). Отбери тех, чей status входит в этапы «с заказчиком». Выведи: сколько всего и список (ФИО, email, текущий этап).`,
            ``,
            `4) Сроки отправки CV: ТОЛЬКО для кандидатов, дошедших до этапа «CV отправлено» (или дальше по воронке), вызови list_applicant_comments (account_id=${args.account_id}, applicant_id=<id>, all_types=true) и найди в журнале запись type=STATUS с переходом на этап «CV отправлено» по этой вакансии — возьми её дату (created). Срок = дата отправки − created вакансии (в днях). НЕ запрашивай логи по всем кандидатам подряд (лимит 10 запросов/сек) — только по дошедшим до заказчика. Кому CV ещё не отправляли — отметь.`,
            ``,
            `Формат отчёта:`,
            `- Шапка: вакансия (название, ${args.vacancy_id}), создана <created>, в работе <N> дней.`,
            `- Кандидаты у заказчика: таблица «кандидат → этап» + итог по этапам.`,
            `- Сроки CV: таблица «кандидат → дата отправки клиенту → дней от старта» и строка «первый CV отправлен через <N> дней».`,
          ].join("\n"),
        },
      }],
    })
  );

  return server;
}

async function main() {
  const args = process.argv.slice(2);
  const server = createServer();

  if (args.includes("--http")) {
    const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const http = await import("node:http");

    const PORT = parseInt(process.env.PORT || "3000", 10);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    await server.connect(transport);

    const httpServer = http.createServer(async (req, res) => {
      if (req.url === "/mcp") {
        await transport.handleRequest(req, res);
      } else if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", tools: TOOL_COUNT, prompts: PROMPT_COUNT }));
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    httpServer.listen(PORT, () => {
      console.error(`[huntflow-mcp] HTTP сервер на порту ${PORT}. POST /mcp, GET /health`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[huntflow-mcp] Сервер запущен (stdio). ${TOOL_COUNT} инструментов, ${PROMPT_COUNT} скилла.`);
  }
}

main().catch((error) => { console.error("[huntflow-mcp] Ошибка:", error); process.exit(1); });
