import { z } from "zod";
import { hfGet } from "../client.js";

// --- Text search for applicants: GET /accounts/{id}/applicants/search (count ≤ 100) ---
// This is the endpoint that actually filters by text. Supports page and count up to 100.
export const searchApplicantsSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  q: z.string().optional().describe("Search string (name, email, resume text)"),
  field: z
    .enum(["all", "education", "experience", "position"])
    .default("all")
    .describe("Where to search: all | education | experience | position"),
  status: z.array(z.number()).optional().describe("Filter by status (stage) IDs"),
  vacancy: z.array(z.number()).optional().describe("Filter by vacancy IDs"),
  count: z.number().int().min(1).max(100).default(30).describe("Items per page (max 100)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
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

// --- Listing applicants filtered by vacancy/status: GET /accounts/{id}/applicants (count ≤ 30) ---
// Natively returns applicants of a specific vacancy/stage without dumping the entire database.
export const listApplicantsSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  vacancy: z.number().optional().describe("Filter by vacancy ID"),
  status: z
    .number()
    .optional()
    .describe("Filter by status (stage) ID. Cannot be used together with agreement_state"),
  agreement_state: z
    .enum(["not_sent", "sent", "accepted", "declined"])
    .optional()
    .describe("Filter by consent to personal data processing. Cannot be used together with status"),
  count: z.number().int().min(1).max(30).default(30).describe("Items per page (max 30)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
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
  account_id: z.number().describe("Account ID"),
  applicant_id: z.number().describe("Applicant ID"),
});

export async function handleGetApplicant(params: z.infer<typeof getApplicantSchema>): Promise<string> {
  const result = await hfGet(`/accounts/${params.account_id}/applicants/${params.applicant_id}`);
  return JSON.stringify(result, null, 2);
}
