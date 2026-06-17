import { z } from "zod";
import { hfGet, hfRequest } from "../client.js";

// Applicant comments are /logs journal entries with type=COMMENT.
// Reading: GET /logs. Creating: POST /logs. There is no editing/deletion in API v2.

export const listApplicantCommentsSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  applicant_id: z.number().describe("Applicant ID"),
  all_types: z
    .boolean()
    .default(false)
    .describe("Show all journal entry types. By default only comments (type=COMMENT)"),
  vacancy: z.number().optional().describe("Filter by vacancy ID (cannot be used together with personal)"),
  personal: z
    .boolean()
    .optional()
    .describe("Only personal notes not tied to a vacancy (cannot be used together with vacancy)"),
  count: z.number().int().min(1).max(100).default(30).describe("Items per page (max 100)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
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
  account_id: z.number().describe("HuntFlow account ID"),
  applicant_id: z.number().describe("Applicant ID"),
  comment: z.string().min(1).max(65535).describe("Comment text"),
  vacancy: z.number().optional().describe("Tie the comment to a vacancy (ID). Without it — a personal note"),
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
