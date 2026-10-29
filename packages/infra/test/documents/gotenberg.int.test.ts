/**
 * The Gotenberg adapter of PdfConverter (#81): a real container (same image as compose.yaml) for the conversion, small local HTTP
 * servers for the failure modes (5xx, a server that never answers, nothing listening).
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { PdfConversionError, type WardReportData } from "@ocop/core";
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { docxRenderer } from "../../src/documents/docx";
import { gotenbergPdfConverter } from "../../src/documents/gotenberg";
import { MINIMAL_PDF } from "../support";

const WARD_REPORT: WardReportData = {
  wardName: "Phường Hòa Bình",
  roundName: "Đợt đánh giá năm 2026",
  entityName: "Hợp tác xã Nông sản Sạch",
  entityKind: "Hợp tác xã",
  identifier: "0101234567",
  address: "12 Đường Lúa Vàng, Phường Hòa Bình",
  representativeName: "Nguyễn Thị Hương",
  phone: "0912345678",
  productName: "Gạo thơm ST25",
  criteriaSetCode: "B01",
  criteriaSetName: "Bộ tiêu chí Gạo",
  submissionNumber: "1",
  submittedOn: "20/10/2026",
  selfScoreTotal: "72,5",
  selfScoreStar: "4 sao",
  checklist: [{ index: "1", label: "Phiếu đăng ký", result: "Đạt" }],
  suggestion: "Đủ điều kiện chuyển tỉnh",
  generatedOn: "28/10/2026",
};

const ascii = (bytes: Uint8Array, n: number) => Buffer.from(bytes.subarray(0, n)).toString("latin1");

describe("Gotenberg PdfConverter", () => {
  let gotenberg: StartedTestContainer;
  let url: string;

  beforeAll(async () => {
    gotenberg = await new GenericContainer("gotenberg/gotenberg:8.39.0").withExposedPorts(3000).withWaitStrategy(Wait.forHttp("/health", 3000)).start();
    url = `http://${gotenberg.getHost()}:${gotenberg.getMappedPort(3000)}`;
  });

  afterAll(async () => {
    await gotenberg?.stop();
  });

  it("converts a generated văn bản (Báo cáo đánh giá cấp xã) to PDF", async () => {
    const docx = await docxRenderer().render("ward_report", WARD_REPORT);
    const pdf = await gotenbergPdfConverter({ url }).toPdf(docx);
    expect(ascii(pdf, 5)).toBe("%PDF-");
  });

  it("reads the fake converter's PDF as a real PDF engine would", async () => {
    const form = new FormData();
    form.append("files", new Blob([MINIMAL_PDF], { type: "application/pdf" }), "fake.pdf");
    const res = await fetch(`${url}/forms/pdfengines/metadata/read`, { method: "POST", body: form });
    expect(res.status).toBe(200);
  });
});

describe("Gotenberg PdfConverter failures", () => {
  const servers: http.Server[] = [];
  const serve = async (handler: http.RequestListener) => {
    const server = http.createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };
  const docx = new Uint8Array(Buffer.from("PK not really a docx"));

  afterAll(async () => {
    for (const s of servers) {
      s.closeAllConnections();
      await new Promise((resolve) => s.close(resolve));
    }
  });

  it("reports a clear error when nothing listens", async () => {
    const server = http.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await new Promise((resolve) => server.close(resolve));
    await expect(gotenbergPdfConverter({ url }).toPdf(docx)).rejects.toMatchObject({
      code: "pdf_conversion_failed",
      detail: expect.stringContaining("ECONNREFUSED"),
    });
  });

  it("reports a 5xx as a conversion error carrying the status", async () => {
    const url = await serve((_req, res) => res.writeHead(503).end("LibreOffice is restarting"));
    const err = await gotenbergPdfConverter({ url })
      .toPdf(docx)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PdfConversionError);
    expect(err).toMatchObject({ detail: expect.stringContaining("503") });
  });

  it("gives up after the timeout instead of hanging", async () => {
    const url = await serve(() => {}); // accepts, never answers
    const started = Date.now();
    await expect(gotenbergPdfConverter({ url, timeoutMs: 300 }).toPdf(docx)).rejects.toMatchObject({
      code: "pdf_conversion_failed",
      detail: expect.stringContaining("300 ms"),
    });
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("refuses a DOCX over the size limit without sending it", async () => {
    let called = false;
    const url = await serve((_req, res) => {
      called = true;
      res.writeHead(500).end();
    });
    await expect(gotenbergPdfConverter({ url, maxBytes: 10 }).toPdf(docx)).rejects.toMatchObject({
      code: "pdf_conversion_failed",
      detail: expect.stringContaining("limit"),
    });
    expect(called).toBe(false);
  });
});
