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

  server.tool("list_accounts", "List of available HuntFlow accounts.", listAccountsSchema.shape,
    async () => ({ content: [{ type: "text", text: await handleListAccounts() }] }));

  server.tool("list_vacancies", "List of vacancies (open/all), with pagination.", listVacanciesSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListVacancies(params) }] }));

  server.tool("get_vacancy", "Full information about a vacancy.", getVacancySchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetVacancy(params) }] }));

  server.tool(
    "list_applicants",
    "Account applicants filtered by vacancy and/or status (stage). Pagination: page, count≤30. For \"applicants for vacancy X\" pass vacancy.",
    listApplicantsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListApplicants(params) }] }));

  server.tool(
    "search_applicants",
    "Text search for applicants (name/email/resume). Pagination: page, count≤100. The q parameter actually filters results.",
    searchApplicantsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleSearchApplicants(params) }] }));

  server.tool("get_applicant", "Full applicant card (external[], links[]).", getApplicantSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetApplicant(params) }] }));

  server.tool(
    "get_applicant_resume",
    "Applicant resume (CV) with body. external_id is taken from get_applicant → external[].id.",
    getApplicantResumeSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleGetApplicantResume(params) }] }));

  server.tool("list_stages", "Recruitment funnel stages (vacancy statuses): code → name.", listStagesSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListStages(params) }] }));

  server.tool("list_rejection_reasons", "Directory of rejection reasons: code → name.", listRejectionReasonsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListRejectionReasons(params) }] }));

  server.tool(
    "list_applicant_comments",
    "Comments about an applicant (log, by default only type=COMMENT). Pagination page/count≤100.",
    listApplicantCommentsSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleListApplicantComments(params) }] }));

  server.tool(
    "add_applicant_comment",
    "Add a comment to an applicant (WRITE operation: creates a log entry; it cannot be edited or deleted via the API).",
    addApplicantCommentSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleAddApplicantComment(params) }] }));

  server.tool(
    "create_applicant",
    "Create an applicant card (WRITE operation: POST /applicants). first_name+last_name are required. Resume — as text (externals[].data.body) and/or file IDs from upload_resume. Repeating creates a DUPLICATE (no idempotency) — check doubles[] in the response.",
    createApplicantSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleCreateApplicant(params) }] }));

  server.tool(
    "attach_applicant_to_vacancy",
    "Attach an applicant to a vacancy and place them on a funnel stage (WRITE operation). vacancy + status (stage ID from list_stages) are required. For rejection — rejection_reason; for hiring — fill_quota + employment_date.",
    attachToVacancySchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleAttachApplicantToVacancy(params) }] }));

  server.tool(
    "upload_resume",
    "Upload a resume file (WRITE operation: multipart). Source: file_path (local path) OR content_base64+file_name. parse=true parses the CV (returns text/fields/photo). Put the id from the response into create_applicant → externals[].files / photo.",
    uploadResumeSchema.shape,
    async (params) => ({ content: [{ type: "text", text: await handleUploadResume(params) }] }));

  // --- Skills / Prompts (3) ---

  server.prompt("skill-applicants", "Applicants for a vacancy — show all applicants attached to the specified vacancy.",
    { account_id: z.string().describe("Account ID"), vacancy_id: z.string().describe("Vacancy ID") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Show all applicants for vacancy ${args.vacancy_id} in account ${args.account_id}.`,
            `Use list_applicants (account_id=${args.account_id}, vacancy=${args.vacancy_id}); page through results via page if needed.`,
            `Resolve stages via list_stages (account_id=${args.account_id}).`,
            `For each applicant show: name, email, phone, current stage.`,
            `Format: a table. At the end — a summary: total count, count per stage.`,
          ].join("\n"),
        },
      }],
    })
  );

  server.prompt("skill-vacancy-stats", "Vacancy statistics — funnel, timing, conversion.",
    { account_id: z.string().describe("Account ID"), vacancy_id: z.string().describe("Vacancy ID") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Show statistics for vacancy ${args.vacancy_id} in account ${args.account_id}.`,
            `Use the tools: get_vacancy, list_stages, list_applicants (vacancy=${args.vacancy_id}, page through to the end).`,
            `Gather: vacancy name, creation date, how many days it has been open,`,
            `number of applicants at each funnel stage, overall conversion.`,
            `Format: first the vacancy card, then the funnel (stage -> count), then conclusions.`,
          ].join("\n"),
        },
      }],
    })
  );

  server.prompt("skill-vacancy-analytics", "Vacancy analytics: days in progress, applicants at customer-facing stages, timing of CV submission to the client.",
    { account_id: z.string().describe("Account ID"), vacancy_id: z.string().describe("Vacancy ID") },
    (args) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Gather analytics for vacancy ${args.vacancy_id} in account ${args.account_id}. Use today's date for timing calculations.`,
            ``,
            `1) Days in progress: get_vacancy (account_id=${args.account_id}, vacancy_id=${args.vacancy_id}) → take position and created. created = the start of work on the vacancy. Metric: today − created in calendar days.`,
            ``,
            `2) Stage map: list_stages (account_id=${args.account_id}). Identify by name:`,
            `   - "customer-facing" stages — names containing these keywords (stages may be named in Russian or English): заказчик / клиент / client / customer / hiring manager;`,
            `   - the "CV sent to client" stage — names like (Russian or English): «отправлен(о) заказчику/клиенту» / «представлен клиенту» / "CV sent" / "submitted to client".`,
            `   If it cannot be determined unambiguously — show the list of stages and ASK the user which ones count as "customer-facing" and which one = "CV sent" before continuing.`,
            ``,
            `3) Applicants at customer-facing stages: list_applicants (account_id=${args.account_id}, vacancy=${args.vacancy_id}, count=30, page=1), then page through to total_pages. For each applicant take from links[] the link with vacancy=${args.vacancy_id} → its status (current stage). Select those whose status is among the "customer-facing" stages. Output: total count and a list (full name, email, current stage).`,
            ``,
            `4) CV submission timing: ONLY for applicants who reached the "CV sent" stage (or further down the funnel), call list_applicant_comments (account_id=${args.account_id}, applicant_id=<id>, all_types=true) and find in the log the type=STATUS entry with a transition to the "CV sent" stage for this vacancy — take its date (created). Timing = submission date − vacancy created (in days). Do NOT request logs for every applicant in a row (limit of 10 requests/sec) — only for those who reached the customer. Mark those whose CV has not been sent yet.`,
            ``,
            `Report format:`,
            `- Header: vacancy (name, ${args.vacancy_id}), created <created>, in progress for <N> days.`,
            `- Applicants with the customer: a "applicant → stage" table + totals per stage.`,
            `- CV timing: a "applicant → date sent to client → days since start" table and a "first CV sent after <N> days" line.`,
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
      console.error(`[huntflow-mcp] HTTP server on port ${PORT}. POST /mcp, GET /health`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`[huntflow-mcp] Server started (stdio). ${TOOL_COUNT} tools, ${PROMPT_COUNT} skills.`);
  }
}

main().catch((error) => { console.error("[huntflow-mcp] Error:", error); process.exit(1); });
