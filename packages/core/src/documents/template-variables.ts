import type { DocumentTemplate, DocumentTemplates, FiveStarPackageDossierRow, MeetingDocumentData, TemplateTag } from "./renderer";

export type { TemplateTag };

/**
 * The variables of each Mẫu văn bản as data (#82 stories 72, 74): what the Quản trị reads before editing a template in
 * Word, and what an uploaded template is checked against. A variable is a {tag}; a loop {#name}…{/name} repeats its
 * biến con once per row. Required variables must appear in every template of the loại, so a văn bản never leaves out
 * what identifies it (the hồ sơ, sản phẩm, điểm, Hạng sao).
 */
export interface TemplateVariable {
  name: string;
  label: string;
  required: boolean;
  /** For a loop, its biến con; a loop's own tag is {#name}…{/name}. */
  children?: readonly TemplateVariable[];
}

/** One spec per field of T: a loop for an array field, with a spec per field of its rows. Missing or extra keys fail to compile. */
type VariableSpecs<T> = {
  [K in keyof T]-?: T[K] extends readonly (infer Row)[]
    ? { label: string; required?: boolean; loop: VariableSpecs<Row> }
    : { label: string; required?: boolean };
};

function list<T>(specs: VariableSpecs<T>): TemplateVariable[] {
  return Object.entries(specs).map(([name, spec]) => {
    const s = spec as { label: string; required?: boolean; loop?: VariableSpecs<unknown> };
    return { name, label: s.label, required: s.required ?? false, ...(s.loop ? { children: list(s.loop) } : {}) };
  });
}

/** Display names of the loại văn bản sinh từ mẫu. */
export const TEMPLATE_LABEL: Record<DocumentTemplate, string> = {
  registration_form: "Phiếu đăng ký sản phẩm",
  self_assessment_report: "Báo cáo tự đánh giá",
  ward_report: "Báo cáo đánh giá cấp xã",
  meeting_score_table: "Bảng tổng hợp điểm",
  meeting_minutes_draft: "Dự thảo biên bản họp Hội đồng",
  recognition_decision_draft: "Dự thảo quyết định công nhận",
  certificate: "Giấy chứng nhận sản phẩm OCOP",
  result_letter: "Thư kết quả không đạt",
  five_star_proposal_letter: "Dự thảo văn bản đề nghị đánh giá 5 sao",
  five_star_package_index: "Mục lục gói đề nghị 5 sao",
};

const req = (label: string) => ({ label, required: true });
const opt = (label: string) => ({ label });

const entityFields = {
  entityName: req("Tên Chủ thể"),
  entityKind: opt("Loại hình Chủ thể (doanh nghiệp, hợp tác xã, hộ kinh doanh...)"),
  identifier: opt("Mã số thuế, hoặc số định danh cá nhân đã che của hộ kinh doanh"),
  address: opt("Địa chỉ Chủ thể"),
  representativeName: opt("Họ tên người đại diện"),
  phone: opt("Số điện thoại"),
  productName: req("Tên sản phẩm"),
  criteriaSetCode: req("Mã Bộ tiêu chí"),
  criteriaSetName: opt("Tên Bộ tiêu chí"),
};

/** The văn bản họp share their data; the quyết định lists only hồ sơ từ 3 sao, without điểm từng thành viên. */
function meetingSpecs(required: { top: (keyof MeetingDocumentData)[]; row: string[] }): VariableSpecs<MeetingDocumentData> {
  const r = <T extends { label: string }>(name: string, s: T, names: readonly string[]) => ({ ...s, required: names.includes(name) });
  const top = (name: keyof MeetingDocumentData, label: string) => r(name, { label }, required.top);
  const row = (name: string, label: string) => r(name, { label }, required.row);
  return {
    councilName: top("councilName", "Tên Hội đồng"),
    roundName: top("roundName", "Tên đợt đánh giá"),
    meetingTitle: top("meetingTitle", "Tên Phiên họp"),
    heldOn: top("heldOn", "Ngày họp"),
    location: top("location", "Địa điểm họp"),
    status: top("status", "Tình trạng số liệu: đã chốt toàn bộ, hay bản nháp còn hồ sơ tạm tính"),
    count: top("count", "Số hồ sơ được liệt kê"),
    dossiers: {
      ...top("dossiers", "Danh sách hồ sơ của Phiên họp, mỗi hồ sơ một dòng"),
      loop: {
        index: row("index", "Số thứ tự"),
        code: row("code", "Mã hồ sơ"),
        entityName: row("entityName", "Tên Chủ thể"),
        address: row("address", "Địa chỉ Chủ thể"),
        productName: row("productName", "Tên sản phẩm"),
        criteriaSet: row("criteriaSet", "Bộ tiêu chí: mã - tên"),
        graders: {
          ...row("graders", "Thành viên chấm của hồ sơ, mỗi người một dòng"),
          loop: { fullName: opt("Họ tên thành viên"), points: opt("Tổng điểm của thành viên, hoặc Vắng / Chưa xác nhận") },
        },
        total: row("total", "Điểm tổng hợp"),
        star: row("star", "Hạng sao"),
        flag: row("flag", "Cờ chênh lệch điểm lớn, nếu có"),
        unmet: row("unmet", "Sao tối thiểu chưa đạt"),
        absent: row("absent", "Thành viên vắng"),
        advisorySummary: row("advisorySummary", "Nhận xét tổng hợp của Báo cáo Tổ tư vấn"),
        status: row("status", "Đã chốt hoặc Tạm tính"),
        note: row("note", "Ghi chú, ví dụ đề nghị xét 5 sao"),
        generalComment: row("generalComment", "Nhận xét chung của Hội đồng về hồ sơ, nếu có"),
      },
    },
    generatedOn: top("generatedOn", "Ngày lập văn bản"),
  };
}

/**
 * The dự thảo quyết định (#79 review S3): its mục 3 sao, 4 sao and đạt điểm đề nghị Trung ương đánh giá 5 sao are the loop
 * `sections`, each with its hồ sơ; `count` and `dossiers` hold only the hồ sơ công nhận (3 and 4 sao).
 */
function recognitionDecisionSpecs(): VariableSpecs<DocumentTemplates["recognition_decision_draft"]> {
  const base = meetingSpecs({ top: ["status"], row: ["productName", "entityName", "star"] });
  return {
    ...base,
    count: opt("Số sản phẩm được công nhận (3 và 4 sao)"),
    dossiers: { ...base.dossiers, label: "Danh sách hồ sơ được công nhận (3 và 4 sao), mỗi hồ sơ một dòng", required: false },
    supplementary: opt(
      "Quyết định công nhận bổ sung (không gắn Phiên họp, chỉ mục 4 sao): dùng {#supplementary}…{/supplementary} và {^supplementary}…{/supplementary}",
    ),
    sections: {
      label:
        "Các mục của quyết định, mỗi mục một bảng: công nhận 3 sao, công nhận 4 sao, đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao (mục này không công nhận); mục không có hồ sơ được bỏ",
      required: true,
      loop: {
        index: opt("Số thứ tự của mục"),
        heading: req("Tên mục"),
        count: opt("Số sản phẩm của mục"),
        dossiers: { ...base.dossiers, label: "Hồ sơ của mục, mỗi hồ sơ một dòng", required: true },
      },
    },
  };
}

const SPECS: { [K in DocumentTemplate]: VariableSpecs<DocumentTemplates[K]> } = {
  registration_form: {
    wardName: opt("Tên xã/phường nhận hồ sơ"),
    roundName: opt("Tên đợt đánh giá"),
    ...entityFields,
    description: opt("Mô tả sản phẩm"),
    ingredients: opt("Thành phần, nguyên liệu"),
    process: opt("Quy trình sản xuất"),
    packaging: opt("Bao bì, nhãn mác"),
    qualityDeclaration: opt("Công bố chất lượng"),
    legalDocuments: {
      label: "Giấy tờ pháp lý, mỗi giấy tờ một dòng",
      loop: { typeName: opt("Loại giấy tờ"), documentNumber: opt("Số giấy tờ"), issuedOn: opt("Ngày cấp") },
    },
    submissionNumber: req("Số thứ tự Phiên bản nộp"),
    submittedOn: req("Ngày nộp"),
  },
  self_assessment_report: {
    entityName: req("Tên Chủ thể"),
    address: opt("Địa chỉ Chủ thể"),
    representativeName: opt("Họ tên người đại diện"),
    productName: req("Tên sản phẩm"),
    criteriaSetCode: req("Mã Bộ tiêu chí"),
    criteriaSetName: opt("Tên Bộ tiêu chí"),
    legalBasis: opt("Căn cứ pháp lý của Bộ tiêu chí"),
    roundName: opt("Tên đợt đánh giá"),
    criteria: {
      label: "Các Tiêu chí tự chấm, mỗi Tiêu chí một dòng",
      required: true,
      loop: {
        partCode: opt("Phần (A, B, C)"),
        code: req("Mã Tiêu chí"),
        name: opt("Tên Tiêu chí"),
        points: req("Điểm tự chấm"),
        explanation: opt("Giải trình"),
        evidence: opt("Minh chứng"),
      },
    },
    total: req("Tổng điểm tự chấm"),
    star: req("Hạng sao tự đánh giá"),
    submissionNumber: req("Số thứ tự Phiên bản nộp"),
    submittedOn: opt("Ngày nộp"),
  },
  ward_report: {
    wardName: req("Tên xã/phường"),
    roundName: opt("Tên đợt đánh giá"),
    ...entityFields,
    criteriaSetCode: opt("Mã Bộ tiêu chí"),
    submissionNumber: opt("Số thứ tự Phiên bản nộp"),
    submittedOn: opt("Ngày nộp"),
    selfScoreTotal: opt("Tổng điểm tự chấm"),
    selfScoreStar: opt("Hạng sao tự đánh giá"),
    checklist: {
      label: "Checklist sơ bộ, mỗi mục một dòng",
      required: true,
      loop: { index: opt("Số thứ tự"), label: req("Nội dung kiểm tra"), result: req("Kết quả") },
    },
    suggestion: req("Đề xuất: đủ hoặc chưa đủ điều kiện chuyển tỉnh"),
    generatedOn: opt("Ngày lập báo cáo"),
  },
  meeting_score_table: meetingSpecs({ top: ["meetingTitle", "heldOn", "status", "dossiers"], row: ["code", "productName", "total", "star"] }),
  meeting_minutes_draft: meetingSpecs({ top: ["meetingTitle", "heldOn", "status", "dossiers"], row: ["code", "productName", "total", "star"] }),
  recognition_decision_draft: recognitionDecisionSpecs(),
  certificate: {
    code: req("Số hiệu giấy chứng nhận, ví dụ 012/2026/GCN-OCOP"),
    productName: req("Tên sản phẩm"),
    entityName: req("Tên Chủ thể"),
    address: opt("Địa chỉ Chủ thể"),
    star: req("Hạng công nhận, ví dụ 4 sao"),
    issuedOn: req("Ngày cấp (ngày ký quyết định công nhận)"),
    expiresOn: req("Ngày hết hiệu lực"),
    decisionNumber: req("Số Quyết định công nhận"),
    decisionSignedOn: opt("Ngày ký Quyết định công nhận"),
  },
  result_letter: {
    letterNumber: opt("Số thứ tự phiên bản thư: 1, hoặc 2 trở đi cho thư đính chính"),
    correctionNote: opt("Ghi chú đính chính (thư nào được đính chính và lý do), để trống ở thư đầu tiên"),
    dossierCode: req("Mã hồ sơ"),
    entityName: req("Tên Chủ thể"),
    address: opt("Địa chỉ Chủ thể"),
    representativeName: opt("Họ tên người đại diện"),
    productName: req("Tên sản phẩm"),
    criteriaSetCode: opt("Mã Bộ tiêu chí"),
    criteriaSetName: opt("Tên Bộ tiêu chí"),
    roundName: opt("Tên đợt đánh giá"),
    total: req("Điểm tổng hợp"),
    parts: { label: "Điểm theo Phần, mỗi Phần một dòng", loop: { code: opt("Phần (A, B, C)"), total: opt("Điểm của Phần") } },
    star: req("Hạng sao"),
    generalComment: opt("Nhận xét chung của Hội đồng"),
    criteria: {
      label: "Tiêu chí dưới mức, mỗi Tiêu chí một dòng",
      required: true,
      loop: {
        index: opt("Số thứ tự"),
        code: req("Mã Tiêu chí"),
        name: opt("Tên Tiêu chí"),
        average: opt("Điểm trung bình"),
        maxPoints: opt("Điểm tối đa"),
        reason: opt("Lý do: Sao tối thiểu chưa đạt, điểm dưới tỷ lệ, hoặc Sở bổ sung"),
      },
    },
    advice: req("Lời khuyên cải thiện của Sở"),
    issuedOn: opt("Ngày phát hành thư"),
  },
  five_star_proposal_letter: {
    count: opt("Số hồ sơ đề nghị"),
    dossiers: {
      label: "Danh sách hồ sơ đề nghị Trung ương đánh giá 5 sao, mỗi hồ sơ một dòng",
      required: true,
      loop: {
        index: opt("Số thứ tự"),
        code: req("Mã hồ sơ"),
        productName: req("Tên sản phẩm"),
        entityName: req("Tên Chủ thể"),
        address: opt("Địa chỉ Chủ thể"),
        wardName: opt("Xã/phường"),
        criteriaSet: opt("Bộ tiêu chí: mã - tên"),
        total: req("Điểm tổng hợp đã chốt"),
        star: opt("Hạng sao đã chốt"),
        decision: opt("Số và ngày Quyết định công nhận"),
      },
    },
    generatedOn: opt("Ngày lập dự thảo"),
  },
  five_star_package_index: {
    count: opt("Số hồ sơ trong gói"),
    rootFiles: { label: "Các tệp ở thư mục gốc của gói", loop: { name: req("Tên tệp") } },
    dossiers: {
      label: "Thư mục của từng hồ sơ",
      required: true,
      loop: {
        index: opt("Số thứ tự"),
        code: opt("Mã hồ sơ"),
        productName: opt("Tên sản phẩm"),
        entityName: opt("Tên Chủ thể"),
        folder: req("Tên thư mục trong gói"),
        files: {
          label: "Các tệp trong thư mục, mỗi tệp một dòng",
          required: true,
          loop: { index: opt("Số thứ tự"), path: req("Đường dẫn tệp trong thư mục") },
        },
      },
    },
    generatedOn: opt("Ngày lập gói"),
  },
};

/**
 * Every loại văn bản sinh từ mẫu. A new loại (Giấy chứng nhận, Thư kết quả không đạt...) adds its data type to
 * DocumentTemplates, then its entries here (SPECS, TEMPLATE_LABEL, TEMPLATE_SAMPLES) and its default .docx in
 * @ocop/infra: the compiler points at each.
 */
export const TEMPLATE_KINDS = Object.keys(SPECS) as DocumentTemplate[];

export const TEMPLATE_VARIABLES: Record<DocumentTemplate, readonly TemplateVariable[]> = Object.fromEntries(
  TEMPLATE_KINDS.map((k) => [k, list(SPECS[k] as VariableSpecs<unknown>)]),
) as Record<string, TemplateVariable[]> as Record<DocumentTemplate, readonly TemplateVariable[]>;

export interface TemplateProblem {
  code: "template_unknown_variable" | "template_missing_variable";
  /** Biến con are named loop.child. */
  variables: string[];
}

interface Scope {
  path: string;
  vars: readonly TemplateVariable[];
}

/**
 * Story 74: a template may use only the variables of its loại, each where it has a value (a biến con inside its
 * loop; a variable of the whole văn bản anywhere), and must use every required one. Unknown variables are
 * reported first, as a template with a misspelt name usually also misses the right one.
 */
export function checkTemplateTags(kind: DocumentTemplate, tags: readonly TemplateTag[]): TemplateProblem | null {
  const unknown = new Set<string>();
  const used = new Set<string>();
  const at = (scope: Scope, name: string) => (scope.path ? `${scope.path}.${name}` : name);

  const visit = (list: readonly TemplateTag[], scopes: Scope[]) => {
    for (const tag of list) {
      const name = typeof tag === "string" ? tag : tag.name;
      let found: { scope: Scope; variable: TemplateVariable } | null = null;
      for (let i = scopes.length - 1; i >= 0 && !found; i--) {
        const variable = scopes[i]!.vars.find((v) => v.name === name);
        if (variable) found = { scope: scopes[i]!, variable };
      }
      const innermost = scopes[scopes.length - 1]!;
      if (!found) unknown.add(at(innermost, name));
      else used.add(at(found.scope, name));
      if (typeof tag === "string") continue;
      const loop = found?.variable.children;
      visit(tag.children, loop ? [...scopes, { path: at(found!.scope, name), vars: loop }] : scopes);
    }
  };
  visit(tags, [{ path: "", vars: TEMPLATE_VARIABLES[kind] }]);
  if (unknown.size > 0) return { code: "template_unknown_variable", variables: [...unknown] };

  const missing: string[] = [];
  const require = (vars: readonly TemplateVariable[], path: string) => {
    for (const v of vars) {
      const p = path ? `${path}.${v.name}` : v.name;
      if (v.required && !used.has(p)) missing.push(p);
      else if (v.children && used.has(p)) require(v.children, p);
    }
  };
  require(TEMPLATE_VARIABLES[kind], "");
  return missing.length > 0 ? { code: "template_missing_variable", variables: missing } : null;
}

export const isTemplateKind = (value: unknown): value is DocumentTemplate => typeof value === "string" && (TEMPLATE_KINDS as string[]).includes(value);

const sampleEntity = {
  entityName: "Hợp tác xã Nông nghiệp Mẫu",
  entityKind: "Hợp tác xã",
  identifier: "0101234567",
  address: "Thôn Đông, xã Mẫu, tỉnh Mẫu",
  representativeName: "Nguyễn Văn Mẫu",
  phone: "0901234567",
  productName: "Mật ong hoa nhãn Mẫu",
  criteriaSetCode: "B1",
  criteriaSetName: "Bộ tiêu chí sản phẩm thực phẩm tươi sống",
};

const sampleMeeting: MeetingDocumentData = {
  councilName: "Hội đồng đánh giá, phân hạng sản phẩm OCOP tỉnh",
  roundName: "Đợt đánh giá năm 2026",
  meetingTitle: "Phiên họp thứ nhất",
  heldOn: "15/11/2026",
  location: "Hội trường Sở Nông nghiệp và Môi trường",
  status: "Số liệu đã chốt của toàn bộ hồ sơ trong Phiên họp.",
  count: "2",
  dossiers: [
    {
      index: "1",
      code: "OCOP-2026-0001",
      entityName: sampleEntity.entityName,
      address: sampleEntity.address,
      productName: sampleEntity.productName,
      criteriaSet: "B1 - Bộ tiêu chí sản phẩm thực phẩm tươi sống",
      graders: [
        { fullName: "Trần Thị Thành Viên", points: "78,00" },
        { fullName: "Lê Văn Thành Viên", points: "74,00" },
      ],
      total: "76,00",
      star: "4 sao",
      flag: "",
      unmet: "",
      absent: "",
      advisorySummary: "Sản phẩm có câu chuyện tốt, cần hoàn thiện bao bì.",
      status: "Đã chốt",
      note: "",
      generalComment: "Đề nghị chủ thể hoàn thiện nhãn mác trước khi cấp giấy chứng nhận.",
    },
    {
      index: "2",
      code: "OCOP-2026-0002",
      entityName: "Công ty TNHH Trà Mẫu",
      address: "Xã Đồi, tỉnh Mẫu",
      productName: "Trà xanh Mẫu",
      criteriaSet: "B2 - Bộ tiêu chí sản phẩm chè",
      graders: [
        { fullName: "Trần Thị Thành Viên", points: "92,00" },
        { fullName: "Lê Văn Thành Viên", points: "91,00" },
      ],
      total: "91,50",
      star: "5 sao",
      flag: "",
      unmet: "",
      absent: "",
      advisorySummary: "Sản phẩm tiêu biểu.",
      status: "Đã chốt",
      note: "Đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao",
      generalComment: "Sản phẩm đạt chất lượng cao, đề nghị giới thiệu xét 5 sao.",
    },
  ],
  generatedOn: "16/11/2026",
};

const sampleFiveStarRow: FiveStarPackageDossierRow = {
  index: "1",
  code: "OCOP-2026-0002",
  productName: "Trà xanh Mẫu",
  entityName: "Công ty TNHH Trà Mẫu",
  address: "Xã Đồi, tỉnh Mẫu",
  wardName: "Xã Đồi",
  criteriaSet: "B2 - Bộ tiêu chí sản phẩm chè",
  total: "91,50",
  star: "5 sao",
  decision: "Số 123/QĐ-UBND, ngày 18/11/2026",
};

/** The fixed data a Sinh thử fills a template with (#82 story 77): every field set, every loop with rows. */
export const TEMPLATE_SAMPLES: { [K in DocumentTemplate]: DocumentTemplates[K] } = {
  registration_form: {
    wardName: "Xã Mẫu",
    roundName: "Đợt đánh giá năm 2026",
    ...sampleEntity,
    description: "Mật ong nguyên chất thu hoạch từ hoa nhãn.",
    ingredients: "Mật ong hoa nhãn 100%.",
    process: "Thu hoạch, lọc, tách nước, đóng chai.",
    packaging: "Chai thủy tinh 500 ml, nhãn có mã truy xuất.",
    qualityDeclaration: "Bản tự công bố số 01/2026/MAU.",
    legalDocuments: [
      { typeName: "Giấy chứng nhận đăng ký hợp tác xã", documentNumber: "0101234567", issuedOn: "02/01/2020" },
      { typeName: "Giấy chứng nhận cơ sở đủ điều kiện an toàn thực phẩm", documentNumber: "12/2025/ATTP", issuedOn: "10/03/2025" },
    ],
    submissionNumber: "1",
    submittedOn: "01/10/2026",
  },
  self_assessment_report: {
    entityName: sampleEntity.entityName,
    address: sampleEntity.address,
    representativeName: sampleEntity.representativeName,
    productName: sampleEntity.productName,
    criteriaSetCode: sampleEntity.criteriaSetCode,
    criteriaSetName: sampleEntity.criteriaSetName,
    legalBasis: "Quyết định số 26/2026/QĐ-TTg",
    roundName: "Đợt đánh giá năm 2026",
    criteria: [
      { partCode: "A", code: "1.1", name: "Nguồn nguyên liệu", points: "4", explanation: "Nguyên liệu tại địa phương.", evidence: "Hợp đồng thu mua.pdf" },
      { partCode: "B", code: "5.1", name: "Tiêu chuẩn sản phẩm", points: "3", explanation: "Đã tự công bố.", evidence: "Bản tự công bố.pdf" },
    ],
    total: "72,00",
    star: "4 sao",
    submissionNumber: "1",
    submittedOn: "01/10/2026",
  },
  ward_report: {
    wardName: "Xã Mẫu",
    roundName: "Đợt đánh giá năm 2026",
    ...sampleEntity,
    submissionNumber: "1",
    submittedOn: "01/10/2026",
    selfScoreTotal: "72,00",
    selfScoreStar: "4 sao",
    checklist: [
      { index: "1", label: "Có đủ giấy tờ pháp lý", result: "Đạt" },
      { index: "2", label: "Phiếu đăng ký được ký đúng", result: "Đạt" },
    ],
    suggestion: "Đủ điều kiện chuyển tỉnh",
    generatedOn: "05/10/2026",
  },
  meeting_score_table: sampleMeeting,
  meeting_minutes_draft: sampleMeeting,
  recognition_decision_draft: {
    ...sampleMeeting,
    count: "1",
    dossiers: [sampleMeeting.dossiers[0]!],
    supplementary: false,
    sections: [
      { index: "1", heading: "Sản phẩm được công nhận đạt 4 sao", count: "1", dossiers: [sampleMeeting.dossiers[0]!] },
      {
        index: "2",
        heading: "Sản phẩm đạt điểm đề nghị Trung ương đánh giá, phân hạng 5 sao",
        count: "1",
        dossiers: [{ ...sampleMeeting.dossiers[1]!, index: "1" }],
      },
    ],
  },
  certificate: {
    code: "012/2026/GCN-OCOP",
    productName: sampleEntity.productName,
    entityName: sampleEntity.entityName,
    address: sampleEntity.address,
    star: "4 sao",
    issuedOn: "19/11/2026",
    expiresOn: "19/11/2029",
    decisionNumber: "123/QĐ-UBND",
    decisionSignedOn: "19/11/2026",
  },
  result_letter: {
    letterNumber: "2",
    correctionNote: "Thư này đính chính Thư kết quả số 1. Lý do: bổ sung tiêu chí còn thiếu.",
    dossierCode: "OCOP-2026-0003",
    entityName: sampleEntity.entityName,
    address: sampleEntity.address,
    representativeName: sampleEntity.representativeName,
    productName: sampleEntity.productName,
    criteriaSetCode: sampleEntity.criteriaSetCode,
    criteriaSetName: sampleEntity.criteriaSetName,
    roundName: "Đợt đánh giá năm 2026",
    total: "45,00",
    parts: [
      { code: "A", total: "20,00" },
      { code: "B", total: "15,00" },
      { code: "C", total: "10,00" },
    ],
    star: "2 sao (không đạt)",
    generalComment: "Sản phẩm chưa có hồ sơ chứng nhận chất lượng.",
    criteria: [
      { index: "1", code: "1.1", name: "Nguồn nguyên liệu", average: "10,00", maxPoints: "40", reason: "Sao tối thiểu chưa đạt" },
      { index: "2", code: "3.1", name: "Chất lượng sản phẩm", average: "5,00", maxPoints: "35", reason: "Điểm trung bình dưới tỷ lệ" },
    ],
    advice: "Bổ sung giấy chứng nhận an toàn thực phẩm và hoàn thiện nhãn mác.",
    issuedOn: "20/11/2026",
  },
  five_star_proposal_letter: { count: "1", dossiers: [sampleFiveStarRow], generatedOn: "20/11/2026" },
  five_star_package_index: {
    count: "1",
    rootFiles: [{ name: "De nghi UBND tinh.docx" }, { name: "Muc luc.pdf" }],
    dossiers: [
      {
        index: sampleFiveStarRow.index,
        code: sampleFiveStarRow.code,
        productName: sampleFiveStarRow.productName,
        entityName: sampleFiveStarRow.entityName,
        folder: "OCOP-2026-0002 - Tra xanh Mau",
        files: [
          { index: "1", path: "01 Phien ban nop 1/Phieu dang ky.docx" },
          { index: "2", path: "05 Bang diem.xlsx" },
        ],
      },
    ],
    generatedOn: "20/11/2026",
  },
};
