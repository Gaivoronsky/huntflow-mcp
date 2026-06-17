import { z } from "zod";
import { hfGet } from "../client.js";

// The resume (CV) body is only available at /externals/{external_id}.
// There is no externals list in v2: external_id is taken from get_applicant → external[].id.
export const getApplicantResumeSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  applicant_id: z.number().describe("Applicant ID"),
  external_id: z.number().describe("Resume ID (external). Taken from get_applicant → external[].id"),
});

export async function handleGetApplicantResume(params: z.infer<typeof getApplicantResumeSchema>): Promise<string> {
  const result = await hfGet(
    `/accounts/${params.account_id}/applicants/${params.applicant_id}/externals/${params.external_id}`,
  );
  return JSON.stringify(result, null, 2);
}
