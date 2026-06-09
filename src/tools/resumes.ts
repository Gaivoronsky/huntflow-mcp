import { z } from "zod";
import { hfGet } from "../client.js";

// Тело резюме (CV) доступно только на /externals/{external_id}.
// Списка externals в v2 нет: external_id берётся из get_applicant → external[].id.
export const getApplicantResumeSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
  applicant_id: z.number().describe("ID кандидата"),
  external_id: z.number().describe("ID резюме (external). Берётся из get_applicant → external[].id"),
});

export async function handleGetApplicantResume(params: z.infer<typeof getApplicantResumeSchema>): Promise<string> {
  const result = await hfGet(
    `/accounts/${params.account_id}/applicants/${params.applicant_id}/externals/${params.external_id}`,
  );
  return JSON.stringify(result, null, 2);
}
