import { randomBytes } from "node:crypto";
import type { FilePurpose, GradingMode, Role, UserActor } from "@ocop/core";
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

  /**
   * Opens a round Đang nhận nộp on the version; the test clock starts on 19/10/2026. Chấm trực tiếp with
   * 5 người chấm tối thiểu unless `opts` says otherwise.
   */
  async function openRound(criteriaVersionId: string, opts: { gradingMode?: GradingMode; minGraders?: number } = {}) {
    const officer = await staff("province_officer");
    const { roundId } = await t.app.rounds.createRound(officer, {
      name: `Đợt ${++seq}`,
      year: 2026,
      submissionDeadline: "2026-11-30",
      forwardingDeadline: "2026-12-15",
      evaluationDeadline: "2027-01-31",
      criteriaVersionId,
      gradingMode: opts.gradingMode ?? "direct",
      aggregation: { method: "mean", minGraders: opts.minGraders ?? 5, deviationFlagPoints: 15 },
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

  /** A hồ sơ Đã chuyển tỉnh and Tiếp nhận tại tỉnh by `province` (a Cán bộ Sở); its đợt must have a Hội đồng. */
  async function provinceReceived(officer: UserActor, province: UserActor, criteriaSetId: string, ward = wardId()) {
    const s = await forwarded(officer, criteriaSetId, ward);
    const { version } = await t.app.dossiers.receiveAtProvince(province, { dossierId: s.dossierId, expectedVersion: s.version });
    return { ...s, version };
  }

  /**
   * L09 HD-06: a hồ sơ Tiếp nhận tại tỉnh, Phân công by `secretary` (Thư ký of the Hội đồng gán to the đợt)
   * to `members` and `advisors`, then Giao chấm: Tổ tư vấn thẩm định or Thành viên xem xét by the đợt's Chế
   * độ chấm. The đợt's minGraders must not exceed `members`; dựa trên Tổ tư vấn needs one advisor, chấm
   * trực tiếp none. Each thành viên chấm then has a Phiếu chấm trống.
   */
  async function gradingStarted(
    officer: UserActor,
    province: UserActor,
    criteriaSetId: string,
    secretary: UserActor,
    people: { members: UserActor[]; advisors?: UserActor[] },
    ward = wardId(),
  ) {
    const s = await provinceReceived(officer, province, criteriaSetId, ward);
    const [drafted] = (
      await t.app.councils.editAssignments(secretary, {
        dossiers: [{ dossierId: s.dossierId, expectedVersion: s.version }],
        members: people.members.map((m) => m.userId),
        advisors: (people.advisors ?? []).map((a) => a.userId),
      })
    ).dossiers;
    const [started] = (await t.app.councils.startGrading(secretary, { dossiers: [{ dossierId: s.dossierId, expectedVersion: drafted!.version }] })).dossiers;
    return { ...s, version: started!.version, state: started!.state };
  }

  /**
   * L10, L11: a hồ sơ Giao chấm in a đợt dựa trên Tổ tư vấn (as `gradingStarted`), whose Báo cáo Tổ tư vấn
   * `people.advisors[0]` writes and issues as phiên bản 1 after being made Tổ trưởng by `province`. Every Tiêu chí
   * gets the Mức điểm with the points in `points` (by mã), else its highest, and the căn cứ "Căn cứ <mã>".
   * The hồ sơ is then Đã có báo cáo Tổ tư vấn.
   */
  async function advisoryIssued(
    officer: UserActor,
    province: UserActor,
    criteriaSetId: string,
    secretary: UserActor,
    people: { members: UserActor[]; advisors: UserActor[] },
    opts: { points?: Record<string, number>; ward?: string } = {},
  ) {
    const leader = people.advisors[0]!;
    await t.app.councils.setLeader(province, { councilId: secretary.activeScope!.id!, userId: leader.userId });
    const s = await gradingStarted(officer, province, criteriaSetId, secretary, people, opts.ward);
    const { criteria } = await t.app.scoring.advisoryReport(leader, { dossierId: s.dossierId });
    const lines = criteria.map((c) => {
      const wanted = opts.points?.[c.code];
      const level = wanted === undefined ? c.levels.reduce((a, b) => (b.points > a.points ? b : a)) : c.levels.find((l) => l.points === wanted)!;
      return { criterionId: c.criterionId, levelId: level.id, basis: `Căn cứ ${c.code}`, evidenceFileIds: [], evidenceAssessment: "sufficient" as const };
    });
    await t.app.scoring.saveAdvisoryDraft(leader, { dossierId: s.dossierId, draftVersion: 0, lines, summary: "Nhận xét tổng hợp", notes: "", attachmentFileIds: [] });
    const { dossierVersion } = await t.app.scoring.advisoryReport(leader, { dossierId: s.dossierId });
    const { version } = await t.app.scoring.issueAdvisoryReport(leader, { dossierId: s.dossierId, expectedVersion: dossierVersion });
    return { ...s, leader, version, state: "advisory_report_issued" as const };
  }

  /**
   * L12: `advisoryIssued`, then the Tổ trưởng sao chép phiên bản 1, all Tiêu chí, to every thành viên chấm: the hồ
   * sơ is Thành viên xem xét and each Phiếu chấm is filled from the Tổ tư vấn, ready to save or xác nhận.
   */
  async function advisoryCopied(...args: Parameters<typeof advisoryIssued>) {
    const s = await advisoryIssued(...args);
    const [copied] = (
      await t.app.scoring.copyAdvisory(s.leader, { dossiers: [{ dossierId: s.dossierId, expectedVersion: s.version }], criteria: "all", recipients: "all" })
    ).dossiers;
    return { ...s, version: copied!.version, state: copied!.state };
  }

  /** Signs the Người dùng of `actor` in again with `role` as the Vai trò đang dùng (one of their Phân vai in force). */
  async function asRole(actor: UserActor, role: Role) {
    const { actor: fresh, token } = await t.signInWithToken(actor.email, PASSWORD);
    const target = (await t.app.identity.myAssignments(fresh)).find((a) => a.role === role);
    if (!target) throw new Error(`${actor.email} holds no Phân vai ${role}`);
    await t.app.identity.switchActiveRole(fresh, { assignmentId: target.id });
    return (await t.app.identity.authenticate(anonymous(), { sessionToken: token }))!;
  }

  /** Grants `actor`'s Người dùng one more Phân vai, as the Quản trị. */
  async function grant(actor: UserActor, role: Role, scopeId: string | null = null) {
    await t.app.identity.grantRole(await admin(), { userId: actor.userId, role, scopeId });
  }

  return {
    admin,
    owner,
    verifiedOwner,
    staff,
    uploadPdf,
    publishedVersion,
    openRound,
    completeDraft,
    submitted,
    received,
    forwarded,
    provinceReceived,
    gradingStarted,
    advisoryIssued,
    advisoryCopied,
    council,
    staffedCouncil,
    asRole,
    grant,
  };
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
