import { z } from "zod";
import { hfGet } from "../client.js";

export const listStagesSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
});

export async function handleListStages(params: z.infer<typeof listStagesSchema>): Promise<string> {
  const result = await hfGet(`/accounts/${params.account_id}/vacancies/statuses`);
  return JSON.stringify(result, null, 2);
}
