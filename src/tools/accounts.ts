import { z } from "zod";
import { hfGet } from "../client.js";

export const listAccountsSchema = z.object({});

export async function handleListAccounts(): Promise<string> {
  const result = await hfGet(`/accounts`);
  return JSON.stringify(result, null, 2);
}
