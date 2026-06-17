import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Set token before importing modules
process.env.HUNTFLOW_TOKEN = "test-token-123";

import { handleListVacancies } from "../src/tools/vacancies.js";
import { handleSearchApplicants, handleListApplicants, handleGetApplicant } from "../src/tools/applicants.js";
import { handleGetApplicantResume } from "../src/tools/resumes.js";
import { handleListStages } from "../src/tools/stages.js";
import { handleListRejectionReasons } from "../src/tools/rejection_reasons.js";
import { handleListApplicantComments, handleAddApplicantComment } from "../src/tools/comments.js";
import { handleListAccounts } from "../src/tools/accounts.js";
import { handleCreateApplicant, handleAttachApplicantToVacancy } from "../src/tools/applicants_write.js";

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockErr(status: number, body: unknown, contentType = "application/json") {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: "Bad Request",
    headers: { get: (h: string) => (h.toLowerCase() === "content-type" ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("list_vacancies", () => {
  it("calls correct URL with opened=true and page", async () => {
    mockOk({ items: [{ id: 1, position: "Dev" }] });
    const result = await handleListVacancies({ account_id: 42, opened: true, count: 10, page: 1 });
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/vacancies");
    expect(url).toContain("opened=true");
    expect(url).toContain("count=10");
    expect(url).toContain("page=1");
    expect(JSON.parse(result).items[0].position).toBe("Dev");
  });

  it("uses correct base URL (huntflow.ru by default)", async () => {
    mockOk({ items: [] });
    await handleListVacancies({ account_id: 1, opened: true, count: 30, page: 1 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toMatch(/^https:\/\/api\.huntflow\.ru\/v2/);
  });
});

describe("search_applicants (текстовый поиск → /applicants/search)", () => {
  it("hits the search endpoint, passes q, field, count, page", async () => {
    mockOk({ items: [{ id: 5, first_name: "Иван" }], total_items: 1, total_pages: 1 });
    const result = await handleSearchApplicants({ account_id: 42, q: "Иван", field: "all", count: 100, page: 2 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/applicants/search");
    expect(url).toContain("q=%D0%98%D0%B2%D0%B0%D0%BD");
    expect(url).toContain("field=all");
    expect(url).toContain("count=100");
    expect(url).toContain("page=2");
    expect(JSON.parse(result).items[0].first_name).toBe("Иван");
  });

  it("appends array filters status[] and vacancy[]", async () => {
    mockOk({ items: [] });
    await handleSearchApplicants({ account_id: 42, field: "all", count: 30, page: 1, status: [1, 2], vacancy: [9] });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("status=1");
    expect(url).toContain("status=2");
    expect(url).toContain("vacancy=9");
  });
});

describe("list_applicants (листинг → /applicants с фильтрами)", () => {
  it("filters by vacancy and status with pagination", async () => {
    mockOk({ items: [{ id: 7 }], total_items: 1, total_pages: 1 });
    await handleListApplicants({ account_id: 42, vacancy: 46542, status: 4039, count: 30, page: 3 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/applicants?");
    expect(url).not.toContain("/applicants/search");
    expect(url).toContain("vacancy=46542");
    expect(url).toContain("status=4039");
    expect(url).toContain("page=3");
  });
});

describe("get_applicant", () => {
  it("calls correct path", async () => {
    mockOk({ id: 7, first_name: "Мария", last_name: "К" });
    await handleGetApplicant({ account_id: 42, applicant_id: 7 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/applicants/7");
  });
});

describe("get_applicant_resume (тело CV → /externals/{external_id})", () => {
  it("calls single-resume endpoint with external_id", async () => {
    mockOk({ id: 4174799, auth_type: "NATIVE", data: { body: "Resume text" } });
    const result = await handleGetApplicantResume({ account_id: 42, applicant_id: 7, external_id: 4174799 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/applicants/7/externals/4174799");
    expect(JSON.parse(result).data.body).toBe("Resume text");
  });
});

describe("list_stages (→ vacancies/statuses, мн.ч.)", () => {
  it("calls the plural vacancies/statuses endpoint", async () => {
    mockOk({ items: [{ id: 1, name: "Новый", order: 0 }] });
    const result = await handleListStages({ account_id: 42 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/vacancies/statuses");
    expect(url).not.toContain("/vacancy/statuses");
    expect(JSON.parse(result).items[0].name).toBe("Новый");
  });
});

describe("list_rejection_reasons", () => {
  it("calls /rejection_reasons", async () => {
    mockOk({ items: [{ id: 4213, name: "Не подошёл по требованиям", order: 1 }] });
    const result = await handleListRejectionReasons({ account_id: 42 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/rejection_reasons");
    expect(JSON.parse(result).items[0].id).toBe(4213);
  });
});

describe("list_accounts", () => {
  it("calls /accounts", async () => {
    mockOk({ items: [{ id: 1, name: "TestCo" }] });
    const result = await handleListAccounts();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts");
    expect(JSON.parse(result).items[0].name).toBe("TestCo");
  });
});

describe("client: заголовки", () => {
  it("sends Bearer token", async () => {
    mockOk({ items: [] });
    await handleListAccounts();
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.headers).toHaveProperty("Authorization", "Bearer test-token-123");
  });

  it("sends a User-Agent header", async () => {
    mockOk({ items: [] });
    await handleListAccounts();
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    expect(opts.headers).toHaveProperty("User-Agent");
    expect((opts.headers as Record<string, string>)["User-Agent"]).toMatch(/huntflow-mcp/);
  });
});

describe("client: проброс тела ошибки апстрима", () => {
  it("includes errors[].type from the response body in the thrown error", async () => {
    mockErr(400, { errors: [{ type: "bad_user_agent" }] });
    await expect(handleListAccounts()).rejects.toThrow(/bad_user_agent/);
  });

  it("includes detail for a validation error", async () => {
    mockErr(400, { errors: [{ type: "validation", detail: "vacancy: invalid" }] });
    await expect(handleListAccounts()).rejects.toThrow(/vacancy: invalid/);
  });

  it("401 surfaces a token hint plus upstream detail", async () => {
    mockErr(401, { errors: [{ type: "token_expired" }] });
    await expect(handleListAccounts()).rejects.toThrow(/401/);
  });
});

describe("list_applicant_comments (журнал → /logs)", () => {
  it("filters type=COMMENT by default, with pagination", async () => {
    mockOk({ items: [{ id: 20, type: "COMMENT", comment: "ok" }], total_items: 1, total_pages: 1 });
    const result = await handleListApplicantComments({ account_id: 42, applicant_id: 7, all_types: false, count: 50, page: 2 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/accounts/42/applicants/7/logs");
    expect(url).toContain("type=COMMENT");
    expect(url).toContain("count=50");
    expect(url).toContain("page=2");
    expect(JSON.parse(result).items[0].comment).toBe("ok");
  });

  it("omits type filter when all_types=true", async () => {
    mockOk({ items: [] });
    await handleListApplicantComments({ account_id: 42, applicant_id: 7, all_types: true, count: 30, page: 1 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("type=COMMENT");
  });
});

describe("add_applicant_comment (запись → POST /logs)", () => {
  it("POSTs the comment in a JSON body", async () => {
    mockOk({ id: 99, type: "COMMENT", comment: "hi" });
    const result = await handleAddApplicantComment({ account_id: 42, applicant_id: 7, comment: "hi", vacancy: 5 });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/accounts/42/applicants/7/logs");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(opts.body as string);
    expect(body.comment).toBe("hi");
    expect(body.vacancy).toBe(5);
    expect(JSON.parse(result).id).toBe(99);
  });

  it("does NOT retry on 5xx (avoids duplicate comments)", async () => {
    mockErr(500, { errors: [{ type: "server_error" }] });
    await expect(
      handleAddApplicantComment({ account_id: 42, applicant_id: 7, comment: "x" }),
    ).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("create_applicant (запись → POST /applicants)", () => {
  it("POSTs applicant fields as JSON to /accounts/{id}/applicants (account_id в путь, не в тело)", async () => {
    mockOk({ id: 555, created: "2026-06-17T10:00:00+03:00", doubles: [] });
    const result = await handleCreateApplicant({
      account_id: 42,
      first_name: "Иван",
      last_name: "Петров",
      email: "ivan@example.com",
      position: "Backend",
      birthday: "1990-05-01",
      externals: [{ auth_type: "NATIVE", data: { body: "резюме" }, files: [777] }],
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/accounts/42/applicants");
    expect(url).not.toContain("/search");
    expect(opts.method).toBe("POST");
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(opts.body as string);
    expect(body.account_id).toBeUndefined();
    expect(body.first_name).toBe("Иван");
    expect(body.last_name).toBe("Петров");
    expect(body.birthday).toBe("1990-05-01");
    expect(body.externals[0].files).toEqual([777]);
    expect(body.externals[0].data.body).toBe("резюме");
    expect(JSON.parse(result).id).toBe(555);
  });

  it("omits undefined optional fields from the body", async () => {
    mockOk({ id: 1, created: "x", doubles: [] });
    await handleCreateApplicant({ account_id: 42, first_name: "А", last_name: "Б" });
    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({ first_name: "А", last_name: "Б" });
    expect("email" in body).toBe(false);
  });

  it("does NOT retry on 5xx (avoids duplicate applicants)", async () => {
    mockErr(500, { errors: [{ type: "server_error" }] });
    await expect(
      handleCreateApplicant({ account_id: 42, first_name: "А", last_name: "Б" }),
    ).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("attach_applicant_to_vacancy (запись → POST .../{aid}/vacancy)", () => {
  it("POSTs vacancy+status to /accounts/{id}/applicants/{aid}/vacancy", async () => {
    mockOk({ id: 999, vacancy: 46542, status: 4039 });
    const result = await handleAttachApplicantToVacancy({
      account_id: 42,
      applicant_id: 7,
      vacancy: 46542,
      status: 4039,
      comment: "первичный отбор",
    });
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/accounts/42/applicants/7/vacancy");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body as string);
    expect(body.account_id).toBeUndefined();
    expect(body.applicant_id).toBeUndefined();
    expect(body.vacancy).toBe(46542);
    expect(body.status).toBe(4039);
    expect(body.comment).toBe("первичный отбор");
    expect(JSON.parse(result).id).toBe(999);
  });

  it("does NOT retry on 5xx", async () => {
    mockErr(500, { errors: [{ type: "server_error" }] });
    await expect(
      handleAttachApplicantToVacancy({ account_id: 42, applicant_id: 7, vacancy: 1, status: 2 }),
    ).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
