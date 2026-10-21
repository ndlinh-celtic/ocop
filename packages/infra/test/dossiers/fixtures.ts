import { randomBytes } from "node:crypto";
import type { FilePurpose, Role, UserActor } from "@ocop/core";
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

  /** A freshly registered and activated Chủ thể of `ward`, signed in; not yet Đã xác thực. */
  async function owner(ward = wardId()) {
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
      wardId: ward,
    });
    await activate(email);
    return t.signInAs(email, PASSWORD);
  }

  /**
   * Uploads a PDF through the files flow (pre-signed PUT, then the scan) and returns its id. With
   * `scan: false` the file is left `scanning`; `content` replaces the random PDF (e.g. EICAR).
   */
  async function uploadPdf(actor: UserActor, purpose: FilePurpose, fileName = "Tệp.pdf", opts: { scan?: boolean; content?: Buffer } = {}) {
    const content = opts.content ?? Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(300)]);
    const { fileId, upload } = await t.app.files.requestUpload(actor, { purpose, fileName, contentType: "application/pdf", size: content.length });
    if (upload.kind !== "single") throw new Error("expected a single PUT");
    const res = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: content });
    if (!res.ok) throw new Error(`PUT ${res.status}`);
    await t.app.files.completeUpload(actor, { fileId });
    if (opts.scan !== false) await t.drainJobs();
    return fileId;
  }

  /** A Chủ thể that is Đã xác thực: it holds a clean, non-expiring GPKD. */
  async function verifiedOwner(ward = wardId()) {
    const a = await owner(ward);
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
  async function staff(role: Role, scopeId: string | null = null) {
    const email = `can-bo-${++seq}@tinh.gov.vn`;
    const a = await admin();
    const { userId } = await t.app.identity.createStaffUser(a, { email, fullName: `Cán Bộ ${seq}` });
    await activate(email);
    await t.app.identity.grantRole(a, { userId, role, scopeId });
    return t.signInAs(email, PASSWORD);
  }

  /**
   * Imports and publishes a Phiên bản tiêu chí with two Bộ tiêu chí; returns its id and its sets by name.
   * `exclusions` is the "Hồ sơ bị loại khi…" header of both sets, split into Điều kiện loại on import.
   * `productGroups` names the Nhóm sản phẩm of each set; both are "Thực phẩm" by default.
   */
  async function publishedVersion(legalBasis: string, opts: { exclusions?: string; productGroups?: [string, string] } = {}) {
    const set = (bo: number, name: string) => ({
      bo,
      ten_bo: name,
      san_pham: opts.productGroups?.[bo - 1] ?? "Thực phẩm",
      nhom: "Thực phẩm tươi sống",
      ghi_chu_dau_phieu: opts.exclusions ?? "",
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

  /**
   * Makes a Nháp ready for submission through the editor's own use cases: the thông tin sản phẩm of
   * PRODUCT, and every Tiêu chí tự chấm at its lowest Mức điểm (a 0-point level is a valid pick).
   */
  async function completeDraft(a: UserActor, dossierId: string) {
    let { version } = await t.app.dossiers.updateProduct(a, { dossierId, expectedVersion: (await t.app.dossiers.get(a, { dossierId })).version, ...PRODUCT });
    const { set } = await t.app.dossiers.selfAssessment(a, { dossierId });
    const criteria = set.parts.flatMap((p) => p.sections.flatMap((s) => s.items.flatMap((i) => (i.kind === "criterion" ? [i] : i.criteria))));
    for (const c of criteria) {
      const lowest = [...c.levels].sort((x, y) => x.points - y.points)[0]!;
      ({ version } = await t.app.dossiers.selfScore(a, { dossierId, expectedVersion: version, criterionId: c.id, levelId: lowest.id }));
    }
    return version;
  }

  /** A Chủ thể Đã xác thực of `ward` with a complete Nháp on `criteriaSetId`, submitted into the đợt Đang nhận nộp. */
  async function submitted(criteriaSetId: string, ward = wardId()) {
    const a = await verifiedOwner(ward);
    const { dossierId } = await t.app.dossiers.create(a, { criteriaSetId });
    const expectedVersion = await completeDraft(a, dossierId);
    const { version } = await t.app.dossiers.submit(a, { dossierId, expectedVersion });
    return { a, dossierId, version };
  }

  /** A hồ sơ submitted to `ward` and Tiếp nhận there by `officer`, a Cán bộ xã of that xã. */
  async function received(officer: UserActor, criteriaSetId: string, ward = wardId()) {
    const s = await submitted(criteriaSetId, ward);
    const { version } = await t.app.dossiers.receive(officer, { dossierId: s.dossierId, expectedVersion: s.version });
    return { ...s, version };
  }

  /**
   * L06: a hồ sơ submitted, Tiếp nhận by `officer` (a Cán bộ xã of its xã), with its Checklist sơ bộ all
   * Đạt and a signed Báo cáo đánh giá cấp xã, then gửi tỉnh: Đã chuyển tỉnh.
   */
  async function forwarded(officer: UserActor, criteriaSetId: string, ward = wardId()) {
    const s = await received(officer, criteriaSetId, ward);
    let { version } = s;
    const { items } = await t.app.dossiers.checklist(officer, { dossierId: s.dossierId });
    ({ version } = await t.app.dossiers.assessChecklist(officer, {
      dossierId: s.dossierId,
      expectedVersion: version,
      results: items.map((i) => ({ itemCode: i.code, result: "pass" as const })),
    }));
    const fileId = await uploadPdf(officer, "signed_ward_report", "BC xã đã ký.pdf");
    ({ version } = await t.app.dossiers.attachSignedWardReport(officer, { dossierId: s.dossierId, expectedVersion: version, fileId }));
    ({ version } = await t.app.dossiers.forwardToProvince(officer, { dossierId: s.dossierId, expectedVersion: version }));
    return { ...s, version };
  }

  /** L09 HD-01: a Hội đồng recorded by `officer` (a Cán bộ Sở), with its quyết định thành lập uploaded as a clean PDF. */
  async function council(officer: UserActor, name = `Hội đồng ${++seq}`) {
    const decisionFileId = await uploadPdf(officer, "council_decision", "QĐ thành lập.pdf");
    const { councilId } = await t.app.councils.create(officer, { name, decisionNumber: `${seq}/QĐ-UBND`, decisionDate: "2026-09-01", decisionFileId });
    return councilId;
  }

  /**
   * A Hội đồng with every Phân vai it needs: Chủ tịch, Thư ký, `members` Thành viên hội đồng and
   * `advisors` Thành viên Tổ tư vấn, each a signed-in Người dùng whose Vai trò đang dùng is that one.
   */
  async function staffedCouncil(officer: UserActor, opts: { members?: number; advisors?: number } = {}) {
    const councilId = await council(officer);
    const chair = await staff("council_chair", councilId);
    const secretary = await staff("council_secretary", councilId);
    const members: UserActor[] = [];
    for (let i = 0; i < (opts.members ?? 3); i++) members.push(await staff("council_member", councilId));
    const advisors: UserActor[] = [];
    for (let i = 0; i < (opts.advisors ?? 2); i++) advisors.push(await staff("advisory_member", councilId));
    return { councilId, chair, secretary, members, advisors };
  }

  return { admin, owner, verifiedOwner, staff, uploadPdf, publishedVersion, openRound, completeDraft, submitted, received, forwarded, council, staffedCouncil };
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
