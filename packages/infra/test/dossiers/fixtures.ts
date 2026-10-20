import { randomBytes } from "node:crypto";
import type { FilePurpose, UserActor } from "@ocop/core";
import { anonymous, type TestApp } from "../support";

export const ADMIN = { email: "admin@tinh.gov.vn", fullName: "Quản Trị", password: "mat-khau-quan-tri-1" };
const PASSWORD = "mat-khau-nguoi-dung-1";

/** Builders for the dossier tests: real registration, activation, uploads and criteria import. */
export function fixtures(t: TestApp, wardId: () => string) {
  let seq = 0;
  let ip = 0;

  const admin = () => t.signInAs(ADMIN.email, ADMIN.password);

  async function activate(email: string) {
    await t.drainJobs();
    const token = /kich-hoat\?token=([\w-]+)/.exec(t.mailbox.to(email).at(-1)!.text)![1]!;
    await t.app.identity.activateAccount(anonymous(), { token, password: PASSWORD });
  }

  /** A freshly registered and activated Chủ thể, signed in; not yet Đã xác thực. */
  async function owner() {
    const n = ++seq;
    const email = `chu-the-${n}@example.vn`;
    await t.app.entities.register(anonymous({ ip: `198.51.100.${++ip}` }), {
      kind: "enterprise",
      name: `Chủ thể ${n}`,
      identifier: `03${String(n).padStart(8, "0")}`,
      address: "Ấp 1",
      representativeName: `Đại diện ${n}`,
      phone: "0901234567",
      email,
      wardId: wardId(),
    });
    await activate(email);
    return t.signInAs(email, PASSWORD);
  }

  /** Uploads a PDF through the files flow (pre-signed PUT, then the scan) and returns its id. */
  async function uploadPdf(actor: UserActor, purpose: FilePurpose, fileName = "Tệp.pdf") {
    const content = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(300)]);
    const { fileId, upload } = await t.app.files.requestUpload(actor, { purpose, fileName, contentType: "application/pdf", size: content.length });
    if (upload.kind !== "single") throw new Error("expected a single PUT");
    const res = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: content });
    if (!res.ok) throw new Error(`PUT ${res.status}`);
    await t.app.files.completeUpload(actor, { fileId });
    await t.drainJobs();
    return fileId;
  }

  /** A Chủ thể that is Đã xác thực: it holds a clean, non-expiring GPKD. */
  async function verifiedOwner() {
    const a = await owner();
    const fileId = await uploadPdf(a, "legal_document", "GPKD.pdf");
    await t.app.entities.addLegalDocument(a, {
      entityId: entityIdOf(a),
      typeCode: "business_registration",
      fileId,
      issuedOn: "2025-01-01",
      validUntil: null,
    });
    return a;
  }

  /** A staff Người dùng holding one Vai trò, through the real activation flow. */
  async function staff(role: "province_officer" | "ward_officer" | "admin", scopeId: string | null = null) {
    const email = `can-bo-${++seq}@tinh.gov.vn`;
    const a = await admin();
    const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: `Cán Bộ ${seq}` });
    await activate(email);
    await t.app.identity.grantRole(a, { userId, role, scopeId });
    return t.signInAs(email, PASSWORD);
  }

  /** Imports and publishes a Phiên bản tiêu chí with two Bộ tiêu chí; returns its id and its sets by name. */
  async function publishedVersion(legalBasis: string) {
    const set = (bo: number, name: string) => ({
      bo,
      ten_bo: name,
      san_pham: "Thực phẩm",
      nhom: "Thực phẩm tươi sống",
      ghi_chu_dau_phieu: "",
      tong_diem: 100,
      tieu_chi: [
        {
          phan: "A",
          phan_ten: "PHẦN A",
          phan_diem: 100,
          muc: "1",
          muc_ten: "MỤC 1",
          muc_diem: 100,
          ma: "1.1",
          ten: "Tiêu chí thử",
          diem_toi_da: 100,
          yeu_cau: "",
          ghi_chu: "",
          lua_chon: [{ thu_tu: 1, mo_ta: "Đạt", diem: 100, sao_toi_thieu: null }],
        },
      ],
    });
    const content = JSON.stringify({
      van_ban: legalBasis,
      ngay_ban_hanh: "2026-01-02",
      hieu_luc: "2026-02-01",
      bo_tieu_chi: [set(1, "Rau củ quả"), set(2, "Thịt tươi")],
    });
    const a = await admin();
    const { versionId } = await t.app.criteria.importVersion(a, { fileName: "tieu-chi.json", content });
    await t.app.criteria.publishVersion(a, { versionId });
    const version = await t.app.criteria.getVersion(a, { versionId });
    const sets = Object.fromEntries(version.productGroups.flatMap((g) => g.subgroups.flatMap((s) => s.sets.map((b) => [b.name, b.id]))));
    return { versionId, sets: sets as Record<"Rau củ quả" | "Thịt tươi", string> };
  }

  /** Opens a round Đang nhận nộp on the version; the test clock starts on 19/10/2026. */
  async function openRound(criteriaVersionId: string) {
    const officer = await staff("province_officer");
    const { roundId } = await t.app.rounds.createRound(officer, {
      name: `Đợt ${++seq}`,
      year: 2026,
      submissionDeadline: "2026-11-30",
      forwardingDeadline: "2026-12-15",
      evaluationDeadline: "2027-01-31",
      criteriaVersionId,
      gradingMode: "direct",
      aggregation: { method: "mean", minGraders: 5, deviationFlagPoints: 15 },
    });
    await t.app.rounds.openRound(officer, { roundId });
    return roundId;
  }

  return { admin, owner, verifiedOwner, staff, uploadPdf, publishedVersion, openRound };
}

export const entityIdOf = (actor: UserActor) => actor.activeScope!.id!;

export const PRODUCT = {
  productName: "Bưởi da xanh An Phú",
  description: "Bưởi trồng theo VietGAP",
  ingredients: "Bưởi tươi",
  process: "Thu hái, phân loại, đóng gói",
  packaging: "Thùng carton 10 kg",
  qualityDeclaration: "Tự công bố số 01/2026",
};
