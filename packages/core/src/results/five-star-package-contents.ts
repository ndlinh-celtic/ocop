import type { ArchiveEntry } from "../documents/archive";
import type { FiveStarPackageDossierRow, FiveStarPackageIndexData, FiveStarProposalLetterData } from "../documents/renderer";
import type { SpreadsheetSheet } from "../documents/spreadsheet";
import { renderDocument } from "../documents/templates";
import type { Dossier, Submission } from "../dossiers/model";
import type { DataScope } from "../identity/scope";
import { vnDateOf } from "../rounds/model";
import { EVIDENCE_ASSESSMENT_LABEL, type AdvisoryReportVersion } from "../scoring/advisory-report-model";
import type { AggregateResult } from "../scoring/meeting-model";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { formatDayVn, formatDecimalVn } from "../shared/format";
import type { Tx } from "../shared/uow";
import { uniqueNames, zipSafeName } from "./zip-names";

/*
 * What goes into the Gói đề nghị 5 sao (#89, spec #79 story 48): for each hồ sơ a folder "<mã hồ sơ> - <tên sản phẩm>"
 * holding the Phiên bản nộp mới nhất (Phiếu đăng ký, Báo cáo tự đánh giá, giấy tờ pháp lý), the minh chứng by Tiêu chí,
 * the newest phiên bản Báo cáo Tổ tư vấn (if any), the newest biên bản đã ký of the Phiên họp, the bảng điểm of the hồ sơ
 * from the snapshot of its kết quả chốt hiện hành, and the Quyết định công nhận đã ký; at the root, the dự thảo văn bản
 * đề nghị and the mục lục. Stored files are copied as they are, read only when the archive reaches them.
 */

export const LETTER_FILE = "De nghi UBND tinh.docx";
export const INDEX_FILE = "Muc luc.pdf";

const PROVINCE: DataScope = { kind: "province" };

const missing = (what: string, code: string) => new DomainError("package_dossier_incomplete", `Hồ sơ ${code} thiếu ${what}`);

/** Files of one folder, each name made Windows-safe and unique there. */
class Folder {
  readonly entries: ArchiveEntry[] = [];
  private readonly unique = uniqueNames();
  constructor(readonly path: string) {}
  add(name: string, content: ArchiveEntry["content"]) {
    this.entries.push({ path: `${this.path}/${this.unique(zipSafeName(name))}`, content });
  }
}

async function storedFile(deps: CoreDeps, tx: Tx, fileId: string): Promise<{ name: string; content: ArchiveEntry["content"] } | null> {
  const f = await tx.files.findById(fileId);
  if (!f || f.status !== "clean") return null;
  return { name: f.fileName, content: () => deps.files.read(f.storageKey) };
}

async function addStored(deps: CoreDeps, tx: Tx, folder: Folder, fileId: string | null, name?: string) {
  if (!fileId) return;
  const f = await storedFile(deps, tx, fileId);
  if (f) folder.add(name ?? f.name, f.content);
}

const starLabel = (star: number) => `${star} sao`;

/** Bảng điểm trích riêng (story 48): each Tiêu chí with the điểm of each thành viên counted, by name, and the trung bình. */
function scoreTable(d: Dossier, s: Submission, r: AggregateResult): SpreadsheetSheet[] {
  const graders = r.snapshot.graders.filter((g) => g.lines !== null);
  const pointsOf = new Map(graders.map((g) => [g.userId, new Map(g.lines!.map((l) => [l.criterionId, l.points]))]));
  return [
    {
      name: "Bang diem",
      columns: [
        { header: "Mã tiêu chí", width: 12 },
        { header: "Tiêu chí", width: 48 },
        { header: "Phần", width: 8 },
        ...graders.map((g) => ({ header: g.fullName, width: 20, format: "decimal2" as const })),
        { header: "Điểm trung bình", width: 16, format: "decimal2" as const },
      ],
      rows: [
        ...s.snapshot.criteria.map((c) => [
          c.code,
          c.name,
          c.partCode,
          ...graders.map((g) => pointsOf.get(g.userId)!.get(c.criterionId) ?? null),
          r.averages[c.criterionId] ?? null,
        ]),
        ["", "Tổng điểm", "", ...graders.map((g) => g.total), r.total],
      ],
    },
    {
      name: "Tong hop",
      columns: [
        { header: "Mã hồ sơ", width: 16 },
        { header: "Sản phẩm", width: 36 },
        { header: "Phiên họp", width: 30 },
        { header: "Ngày họp", width: 12 },
        { header: "Điểm tổng hợp", width: 14, format: "decimal2" },
        { header: "Hạng sao", width: 10 },
        { header: "Thành viên vắng", width: 30 },
        { header: "Chốt lúc", width: 18, format: "datetime" },
      ],
      rows: [
        [
          d.code,
          d.productName,
          r.snapshot.meeting.title,
          formatDayVn(r.snapshot.meeting.heldOn),
          r.total,
          starLabel(r.star),
          r.snapshot.absent.map((a) => a.fullName).join("; "),
          r.finalizedAt,
        ],
      ],
    },
  ];
}

/** The newest phiên bản Báo cáo Tổ tư vấn, as issued, in a workbook. */
function advisorySheets(v: AdvisoryReportVersion): SpreadsheetSheet[] {
  const s = v.snapshot;
  return [
    {
      name: "Diem de xuat",
      columns: [
        { header: "Mã tiêu chí", width: 12 },
        { header: "Tiêu chí", width: 40 },
        { header: "Phần", width: 8 },
        { header: "Điểm đề xuất", width: 14, format: "decimal2" },
        { header: "Mức điểm", width: 30 },
        { header: "Căn cứ", width: 40 },
        { header: "Đánh giá minh chứng", width: 22 },
        { header: "Minh chứng", width: 40 },
      ],
      rows: s.lines.map((l) => [
        l.code,
        l.name,
        l.partCode,
        l.points,
        l.levelDescription,
        l.basis,
        l.evidenceAssessment ? EVIDENCE_ASSESSMENT_LABEL[l.evidenceAssessment] : "",
        l.evidence.map((e) => e.fileName).join("; "),
      ]),
    },
    {
      name: "Nhan xet",
      columns: [
        { header: "Phiên bản", width: 10, format: "integer" },
        { header: "Nhận xét tổng hợp", width: 60 },
        { header: "Điểm cần hội đồng lưu ý", width: 60 },
        { header: "Tổng điểm ước lượng", width: 18, format: "decimal2" },
        { header: "Phát hành lúc", width: 18, format: "datetime" },
      ],
      rows: [[v.number, s.summary, s.notes, s.estimate.total, v.issuedAt]],
    },
  ];
}

interface DossierPart {
  row: FiveStarPackageDossierRow;
  folder: Folder;
}

async function dossierPart(deps: CoreDeps, tx: Tx, dossierId: string, index: number): Promise<DossierPart> {
  const d = await tx.dossiers.findById(PROVINCE, dossierId);
  if (!d) throw new DomainError("not_found", "Không tìm thấy hồ sơ của gói");
  const result = await tx.aggregateResults.current(d.id);
  if (!result) throw missing("kết quả chốt", d.code);
  const submission = await tx.dossiers.latestSubmission(d.id);
  if (!submission) throw missing("Phiên bản nộp", d.code);
  const snap = submission.snapshot;
  const folder = new Folder(zipSafeName(`${d.code} - ${d.productName}`));

  // 01: Phiên bản nộp mới nhất.
  const nop = new Folder(`${folder.path}/01 Phien ban nop ${submission.number}`);
  await addStored(deps, tx, nop, snap.documents.registrationForm, "Phieu dang ky.docx");
  await addStored(deps, tx, nop, snap.documents.selfAssessmentReport, "Bao cao tu danh gia.docx");
  const legal = new Folder(`${nop.path}/Giay to phap ly`);
  for (const l of snap.legalDocuments) await addStored(deps, tx, legal, l.fileId, l.fileName);

  // 02: minh chứng by Tiêu chí, in sheet order; a file of the kho tied to none goes on its own.
  const names = new Map(snap.evidence.map((e) => [e.fileId, e.fileName]));
  const tied = new Set<string>();
  const evidence: Folder[] = [];
  for (const c of snap.criteria) {
    if (c.evidenceFileIds.length === 0) continue;
    const f = new Folder(`${folder.path}/02 Minh chung/${zipSafeName(`${c.code} ${c.name}`)}`);
    for (const id of c.evidenceFileIds) {
      tied.add(id);
      await addStored(deps, tx, f, id, names.get(id));
    }
    evidence.push(f);
  }
  const untied = new Folder(`${folder.path}/02 Minh chung/Chua gan tieu chi`);
  for (const e of snap.evidence) if (!tied.has(e.fileId)) await addStored(deps, tx, untied, e.fileId, e.fileName);
  evidence.push(untied);

  // 03: phiên bản Báo cáo Tổ tư vấn mới nhất, with its tệp đính kèm.
  const advisory = new Folder(`${folder.path}/03 Bao cao To tu van`);
  const latestAdvisory = (await tx.advisoryReports.versions(d.id)).at(-1);
  if (latestAdvisory) {
    advisory.add(`Bao cao To tu van phien ban ${latestAdvisory.number}.xlsx`, await deps.spreadsheets.write(advisorySheets(latestAdvisory)));
    const attachments = new Folder(`${advisory.path}/Tep dinh kem`);
    for (const a of latestAdvisory.snapshot.attachments) await addStored(deps, tx, attachments, a.fileId, a.fileName);
    advisory.entries.push(...attachments.entries);
  }

  // 04: biên bản đã ký mới nhất of the Phiên họp of the kết quả chốt.
  const minutes = new Folder(`${folder.path}/04 Bien ban hop`);
  const [newestMinutes] = await tx.meetings.minutes(result.meetingId);
  if (newestMinutes) await addStored(deps, tx, minutes, newestMinutes.fileId);

  // 05: bảng điểm trích riêng; 06: Quyết định công nhận đã ký.
  folder.add("05 Bang diem.xlsx", await deps.spreadsheets.write(scoreTable(d, submission, result)));
  const decisions = await tx.recognitionDecisions.ofDossier(d.id);
  const decisionFolder = new Folder(`${folder.path}/06 Quyet dinh cong nhan`);
  for (const dec of decisions) await addStored(deps, tx, decisionFolder, dec.fileId);

  folder.entries.unshift(...nop.entries, ...legal.entries, ...evidence.flatMap((f) => f.entries), ...advisory.entries, ...minutes.entries);
  folder.entries.push(...decisionFolder.entries);

  const entity = await tx.entities.findById(PROVINCE, d.entityId);
  const ward = d.wardId ? (await tx.wards.list()).find((w) => w.id === d.wardId) : undefined;
  const decision = decisions.at(-1);
  return {
    folder,
    row: {
      index: String(index),
      code: d.code,
      productName: d.productName,
      entityName: entity?.name ?? snap.entity.name,
      address: entity?.address ?? snap.entity.address,
      wardName: ward?.name ?? "",
      criteriaSet: `${snap.criteriaSet.code} - ${snap.criteriaSet.name}`,
      total: formatDecimalVn(result.total),
      star: starLabel(result.star),
      decision: decision ? `Số ${decision.number}, ngày ${formatDayVn(decision.signedOn)}` : "",
    },
  };
}

/** Every entry of the package, root files first; the mục lục lists them all by folder. */
export async function packageEntries(deps: CoreDeps, tx: Tx, dossierIds: readonly string[]): Promise<ArchiveEntry[]> {
  const parts: DossierPart[] = [];
  for (const [i, id] of dossierIds.entries()) parts.push(await dossierPart(deps, tx, id, i + 1));

  const generatedOn = formatDayVn(vnDateOf(deps.clock.now()));
  const letter: FiveStarProposalLetterData = { count: String(parts.length), dossiers: parts.map((p) => p.row), generatedOn };
  const index: FiveStarPackageIndexData = {
    count: String(parts.length),
    rootFiles: [{ name: LETTER_FILE }, { name: INDEX_FILE }],
    dossiers: parts.map((p) => ({
      index: p.row.index,
      code: p.row.code,
      productName: p.row.productName,
      entityName: p.row.entityName,
      folder: p.folder.path,
      files: p.folder.entries.map((e, i) => ({ index: String(i + 1), path: e.path.slice(p.folder.path.length + 1) })),
    })),
    generatedOn,
  };
  const { bytes: letterBytes } = await renderDocument(deps, tx, "five_star_proposal_letter", letter);
  const { bytes: indexDocx } = await renderDocument(deps, tx, "five_star_package_index", index);
  return [
    { path: LETTER_FILE, content: letterBytes },
    { path: INDEX_FILE, content: await deps.pdf.toPdf(indexDocx) },
    ...parts.flatMap((p) => p.folder.entries),
  ];
}
