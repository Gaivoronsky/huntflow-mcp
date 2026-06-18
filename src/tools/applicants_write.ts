import { z } from "zod";
import { hfRequest } from "../client.js";

// --- WRITE operations for applicants ---
// Create card: POST /accounts/{id}/applicants (ApplicantCreateRequest, application/json).
// Attach to vacancy / move to stage: POST /accounts/{id}/applicants/{aid}/vacancy (AddApplicantToVacancyRequest).
// IMPORTANT: POST in client.ts is intentionally not retried — HuntFlow has no idempotency, a retry creates a duplicate.

// Resume inside the card (externals[]). files — an array of INTEGER IDs of uploaded files
// (from upload_resume → id). Confirmed against the live OpenAPI (ApplicantResumeCreate).
const externalSchema = z.object({
  auth_type: z
    .string()
    .optional()
    .describe('Resume origin type. Use "NATIVE" for files uploaded via upload_resume (the default). Do NOT put the source name here — the source goes in account_source.'),
  account_source: z
    .number()
    .optional()
    .describe("Source ID — numeric id from list_account_sources (e.g. resolve a source named \"RG\" to its id). NOT a string name."),
  files: z.array(z.number()).optional().describe("IDs of uploaded files (from upload_resume → id)"),
  data: z
    .object({ body: z.string().optional().describe("Resume text") })
    .optional()
    .describe("Resume contents (e.g. the recognized text from upload_resume → text)"),
});

const socialSchema = z.object({
  social_type: z.string().describe("Type: telegram, skype, etc."),
  value: z.string().describe("Value (handle/identifier)"),
});

const siteSchema = z.object({
  site_type: z.string().describe("Site type"),
  value: z.string().describe("URL/value"),
});

export const createApplicantSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  first_name: z.string().min(1).describe("First name (required)"),
  last_name: z.string().min(1).describe("Last name (required)"),
  middle_name: z.string().optional().describe("Middle name"),
  phone: z.string().optional().describe("Phone"),
  email: z.string().email().optional().describe("Email"),
  position: z.string().optional().describe("Desired position"),
  company: z.string().optional().describe("Current/last company"),
  money: z.string().optional().describe('Salary expectations as a string, e.g. "200000 RUB"'),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Date of birth ISO YYYY-MM-DD (single field, NOT day/month/year)"),
  photo: z.number().optional().describe("ID of the uploaded photo (from upload_resume → id)"),
  externals: z.array(externalSchema).optional().describe("Applicant's resume (text and/or file IDs)"),
  social: z.array(socialSchema).optional().describe("Social networks/messengers"),
  site: z.array(siteSchema).optional().describe("Sites/links"),
});

export async function handleCreateApplicant(
  params: z.infer<typeof createApplicantSchema>,
): Promise<string> {
  const { account_id, ...rest } = params;
  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) body[key] = value;
  }
  // Default auth_type to "NATIVE" for each resume (files uploaded via upload_resume are native).
  // The source belongs in account_source (numeric), not auth_type — a common mix-up.
  if (Array.isArray(body.externals)) {
    body.externals = (body.externals as Array<Record<string, unknown>>).map(({ auth_type, ...ext }) => ({
      auth_type: auth_type ?? "NATIVE",
      ...ext,
    }));
  }
  const result = await hfRequest("POST", `/accounts/${account_id}/applicants`, body);
  return JSON.stringify(result, null, 2);
}

export const attachToVacancySchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  applicant_id: z.number().describe("Applicant ID (from create_applicant → id)"),
  vacancy: z.number().describe("Vacancy ID (required)"),
  status: z.number().describe("Pipeline stage ID from list_stages (required)"),
  comment: z.string().optional().describe("Comment for the transition"),
  rejection_reason: z.number().optional().describe("Rejection reason ID (list_rejection_reasons) — for the rejection stage"),
  fill_quota: z.number().optional().describe("Quota ID — for the hiring stage"),
  employment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Employment start date YYYY-MM-DD"),
  files: z.array(z.number()).optional().describe("IDs of attached files"),
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

// Update an EXISTING resume (external) of an applicant: PUT .../externals/{external_id}.
// Use to fix the source (account_source) or replace the resume text/files on a card that
// ALREADY has a resume. external_id comes from get_applicant → external[].id.
// NOTE: the HuntFlow v2 API has no endpoint to ADD a brand-new resume to an applicant created
// without one — a resume can only be attached at creation (create_applicant → externals[]).
export const updateApplicantExternalSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  applicant_id: z.number().describe("Applicant ID"),
  external_id: z.number().describe("Resume (external) ID — from get_applicant → external[].id"),
  account_source: z.number().describe("Source ID (required) — numeric id from list_account_sources"),
  body: z.string().describe("Resume text (required) — maps to data.body"),
  files: z.array(z.number()).optional().describe("IDs of attached files (from upload_resume → id)"),
});

export async function handleUpdateApplicantExternal(
  params: z.infer<typeof updateApplicantExternalSchema>,
): Promise<string> {
  const { account_id, applicant_id, external_id, account_source, body: resumeBody, files } = params;
  const payload: Record<string, unknown> = {
    account_source,
    data: { body: resumeBody },
  };
  if (files !== undefined) payload.files = files;
  const result = await hfRequest(
    "PUT",
    `/accounts/${account_id}/applicants/${applicant_id}/externals/${external_id}`,
    payload,
  );
  return JSON.stringify(result, null, 2);
}
