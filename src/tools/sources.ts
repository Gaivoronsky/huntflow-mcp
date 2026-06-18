import { z } from "zod";
import { hfGet } from "../client.js";

// Applicant resume sources (e.g. "RG", "HeadHunter", ...) — reference list for the account.
// GET /accounts/{id}/applicants/sources → { items: [{ id, foreign?, name, type }] }.
// The numeric `id` is what goes into create_applicant → externals[].account_source
// (and update_applicant_external → account_source). Resolve a source by its `name` here first.
export const listAccountSourcesSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
});

export async function handleListAccountSources(
  params: z.infer<typeof listAccountSourcesSchema>,
): Promise<string> {
  const result = await hfGet(`/accounts/${params.account_id}/applicants/sources`);
  return JSON.stringify(result, null, 2);
}
