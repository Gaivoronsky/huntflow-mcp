import { z } from "zod";
import { hfGet } from "../client.js";

// Справочник причин отказа — декодирует числовые links[].rejection_reason из карточек кандидатов.
export const listRejectionReasonsSchema = z.object({
  account_id: z.number().describe("ID аккаунта HuntFlow"),
});

export async function handleListRejectionReasons(
  params: z.infer<typeof listRejectionReasonsSchema>,
): Promise<string> {
  const result = await hfGet(`/accounts/${params.account_id}/rejection_reasons`);
  return JSON.stringify(result, null, 2);
}
