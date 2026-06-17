import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { hfUpload } from "../client.js";

// Resume file upload: POST /accounts/{id}/upload (multipart/form-data, file field).
// The X-File-Parse: true header enables CV recognition — the response contains text/fields/photo
// and the file id, which is passed into create_applicant → externals[].files / photo.
// File source: either a local path (file_path, the server reads the bytes) or base64 (content_base64).
export const uploadResumeSchema = z.object({
  account_id: z.number().describe("HuntFlow account ID"),
  file_path: z
    .string()
    .optional()
    .describe("Local path to the file (the server will read the bytes). Alternatively use content_base64"),
  content_base64: z
    .string()
    .optional()
    .describe("File contents in base64 (alternative to file_path). Requires file_name"),
  file_name: z
    .string()
    .optional()
    .describe("File name for content_base64 (e.g. resume.pdf). For file_path it is taken from the path"),
  content_type: z
    .string()
    .optional()
    .describe("MIME type (e.g. application/pdf). Defaults to application/octet-stream"),
  parse: z
    .boolean()
    .default(true)
    .describe("Parse the resume (X-File-Parse). Returns text/fields/photo to populate the applicant card"),
});

export async function handleUploadResume(
  params: z.infer<typeof uploadResumeSchema>,
): Promise<string> {
  // .shape is needed for server.tool(), so we do cross-field validation here rather than via .refine().
  const hasPath = Boolean(params.file_path);
  const hasBase64 = Boolean(params.content_base64);
  if (hasPath === hasBase64) {
    throw new Error("upload_resume: specify exactly one file source — file_path OR content_base64.");
  }
  if (hasBase64 && !params.file_name) {
    throw new Error("upload_resume: file_name is required for content_base64.");
  }

  let bytes: Uint8Array;
  let filename: string;
  if (params.file_path) {
    bytes = await readFile(params.file_path);
    filename = params.file_name || basename(params.file_path);
  } else {
    bytes = Buffer.from(params.content_base64 as string, "base64");
    filename = params.file_name as string;
  }

  const parse = params.parse ?? true;
  const result = await hfUpload(`/accounts/${params.account_id}/upload`, bytes, filename, {
    parse,
    contentType: params.content_type,
  });
  return JSON.stringify(result, null, 2);
}
