import { describe, it, expect, vi, beforeEach } from "vitest";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.HUNTFLOW_TOKEN = "test-token-123";

import { handleUploadResume } from "../src/tools/uploads.js";

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => data });
}

function mockErr(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: "Server Error",
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? "application/json" : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("upload_resume (multipart → POST /accounts/{id}/upload)", () => {
  it("POSTs multipart FormData with the file field from content_base64", async () => {
    mockOk({ id: 7777, name: "cv.pdf", text: "распознанный текст", photo: null });
    const content = Buffer.from("PDF-BYTES-РЕЗЮМЕ").toString("base64");
    const result = await handleUploadResume({
      account_id: 42,
      content_base64: content,
      file_name: "cv.pdf",
      content_type: "application/pdf",
      parse: true,
    });

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/accounts/42/upload");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);

    const fd = opts.body as FormData;
    const file = fd.get("file") as File;
    expect(file).toBeTruthy();
    expect(file.name).toBe("cv.pdf");
    const bytes = Buffer.from(await file.arrayBuffer()).toString();
    expect(bytes).toBe("PDF-BYTES-РЕЗЮМЕ");

    expect(JSON.parse(result).id).toBe(7777);
  });

  it("does NOT set Content-Type: application/json (lets fetch build the multipart boundary)", async () => {
    mockOk({ id: 1 });
    await handleUploadResume({
      account_id: 42,
      content_base64: Buffer.from("x").toString("base64"),
      file_name: "a.txt",
      parse: false,
    });
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("sends X-File-Parse: true when parse=true", async () => {
    mockOk({ id: 1, text: "parsed" });
    await handleUploadResume({
      account_id: 42,
      content_base64: Buffer.from("x").toString("base64"),
      file_name: "a.txt",
      parse: true,
    });
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>)["X-File-Parse"]).toBe("true");
  });

  it("omits X-File-Parse when parse=false", async () => {
    mockOk({ id: 1 });
    await handleUploadResume({
      account_id: 42,
      content_base64: Buffer.from("x").toString("base64"),
      file_name: "a.txt",
      parse: false,
    });
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect((opts.headers as Record<string, string>)["X-File-Parse"]).toBeUndefined();
  });

  it("reads bytes and filename from a local file_path", async () => {
    mockOk({ id: 2, name: "resume.txt" });
    const dir = await mkdtemp(join(tmpdir(), "hf-upload-"));
    const path = join(dir, "resume.txt");
    await writeFile(path, "LOCAL-FILE-СОДЕРЖИМОЕ");

    await handleUploadResume({ account_id: 42, file_path: path, parse: true });

    const fd = mockFetch.mock.calls[0][1] as RequestInit;
    const file = (fd.body as FormData).get("file") as File;
    expect(file.name).toBe("resume.txt");
    const bytes = Buffer.from(await file.arrayBuffer()).toString();
    expect(bytes).toBe("LOCAL-FILE-СОДЕРЖИМОЕ");
  });

  it("rejects when neither file_path nor content_base64 is given", async () => {
    await expect(handleUploadResume({ account_id: 42, parse: true })).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects when both file_path and content_base64 are given", async () => {
    await expect(
      handleUploadResume({
        account_id: 42,
        file_path: "/tmp/x",
        content_base64: "eA==",
        file_name: "x",
        parse: true,
      }),
    ).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects content_base64 without file_name", async () => {
    await expect(
      handleUploadResume({ account_id: 42, content_base64: "eA==", parse: true }),
    ).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does NOT retry on 5xx (avoids duplicate uploads)", async () => {
    mockErr(500, { errors: [{ type: "server_error" }] });
    await expect(
      handleUploadResume({
        account_id: 42,
        content_base64: Buffer.from("x").toString("base64"),
        file_name: "a.txt",
        parse: true,
      }),
    ).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
