import { z } from "zod";
import { hfGet } from "../client.js";

// Rejection reasons reference — decodes the numeric links[].rejection_reason values from applicant cards.
export const listRejectionReasonsSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
});

export async function handleListRejectionReasons(
  params: z.infer<typeof listRejectionReasonsSchema>,
): Promise<string> {
  const result = await hfGet(`/accounts/${params.account_id}/rejection_reasons`);
  return JSON.stringify(result, null, 2);
}
