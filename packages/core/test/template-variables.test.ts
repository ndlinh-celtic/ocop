import { describe, expect, it } from "vitest";
import {
  checkTemplateTags,
  TEMPLATE_KINDS,
  TEMPLATE_SAMPLES,
  TEMPLATE_VARIABLES,
  type TemplateTag,
  type TemplateVariable,
} from "../src/documents/template-variables";

/** The variable names, nested under their loop, of a variable list or of a sample data object. */
type Shape = { [name: string]: Shape | true };

const shapeOfVariables = (vars: readonly TemplateVariable[]): Shape =>
  Object.fromEntries(vars.map((v) => [v.name, v.children ? shapeOfVariables(v.children) : true]));

function shapeOfData(data: object): Shape {
  return Object.fromEntries(
    Object.entries(data).map(([name, value]) => {
      if (!Array.isArray(value)) return [name, true];
      // A loop's sample holds at least one row, and every row has every field.
      expect(value.length, `sample of loop ${name}`).toBeGreaterThan(0);
      return [name, shapeOfData(value[0] as object)];
    }),
  );
}

describe("Mẫu văn bản: danh sách biến (#82 story 72)", () => {
  it("covers the six văn bản sinh từ mẫu of steps 3 and 4", () => {
    expect([...TEMPLATE_KINDS].sort()).toEqual(
      ["meeting_minutes_draft", "meeting_score_table", "recognition_decision_draft", "registration_form", "self_assessment_report", "ward_report"].sort(),
    );
  });

  // TEMPLATE_SAMPLES is typed DocumentTemplates[K], so its fields are exactly the type's: comparing the two shapes
  // checks the runtime list against the type, loops and their biến con included.
  it.each(TEMPLATE_KINDS)("the variables of %s are exactly the fields of DocumentTemplates", (kind) => {
    expect(shapeOfVariables(TEMPLATE_VARIABLES[kind])).toEqual(shapeOfData(TEMPLATE_SAMPLES[kind]));
  });

  it.each(TEMPLATE_KINDS)("every variable of %s has a Vietnamese description", (kind) => {
    const all = (vars: readonly TemplateVariable[]): TemplateVariable[] => vars.flatMap((v) => [v, ...all(v.children ?? [])]);
    for (const v of all(TEMPLATE_VARIABLES[kind])) expect(v.label.trim(), `${kind}.${v.name}`).not.toBe("");
  });

  it("marks a loop with its biến con, e.g. the Tiêu chí of the Báo cáo tự đánh giá", () => {
    const criteria = TEMPLATE_VARIABLES.self_assessment_report.find((v) => v.name === "criteria");
    expect(criteria?.children?.map((c) => c.name)).toEqual(["partCode", "code", "name", "points", "explanation", "evidence"]);
  });
});

describe("Mẫu văn bản: kiểm biến của mẫu tải lên (#82 story 74)", () => {
  // The tags of the Phiếu đăng ký shipped with the app, as the renderer reads them: {#documentNumber}…{/documentNumber}
  // is a condition on a biến con, not a loop.
  const registration: TemplateTag[] = [
    "wardName",
    "roundName",
    "entityName",
    "entityKind",
    "identifier",
    "address",
    "representativeName",
    "phone",
    "productName",
    "criteriaSetCode",
    "criteriaSetName",
    "description",
    "ingredients",
    "process",
    "packaging",
    "qualityDeclaration",
    { name: "legalDocuments", children: ["typeName", { name: "documentNumber", children: ["documentNumber"] }, "issuedOn"] },
    "submissionNumber",
    "submittedOn",
    "representativeName",
  ];

  it("accepts the default Phiếu đăng ký", () => {
    expect(checkTemplateTags("registration_form", registration)).toBeNull();
  });

  it("reports a variable that is not in the list, by name", () => {
    expect(checkTemplateTags("registration_form", [...registration, "tenCoSo"])).toEqual({ code: "template_unknown_variable", variables: ["tenCoSo"] });
  });

  it("reports a missing required variable, by name", () => {
    const withoutProduct = registration.filter((t) => t !== "productName" && t !== "submittedOn");
    expect(checkTemplateTags("registration_form", withoutProduct)).toEqual({ code: "template_missing_variable", variables: ["productName", "submittedOn"] });
  });

  it("accepts leaving out an optional variable", () => {
    expect(
      checkTemplateTags(
        "registration_form",
        registration.filter((t) => t !== "phone"),
      ),
    ).toBeNull();
  });

  it("checks a loop's biến con against that loop, naming them loop.child", () => {
    const tags: TemplateTag[] = [...registration.filter((t) => typeof t === "string"), { name: "legalDocuments", children: ["typeName", "soHieu"] }];
    expect(checkTemplateTags("registration_form", tags)).toEqual({ code: "template_unknown_variable", variables: ["legalDocuments.soHieu"] });
  });

  it("lets a loop row use a variable of the whole văn bản", () => {
    const tags: TemplateTag[] = [...registration, { name: "legalDocuments", children: ["typeName", "entityName"] }];
    expect(checkTemplateTags("registration_form", tags)).toBeNull();
  });

  it("refuses a biến con outside its loop", () => {
    expect(checkTemplateTags("registration_form", [...registration, "typeName"])).toEqual({ code: "template_unknown_variable", variables: ["typeName"] });
  });

  it("refuses a loop whose required biến con is missing", () => {
    const tags: TemplateTag[] = [
      "meetingTitle",
      "heldOn",
      "status",
      { name: "dossiers", children: ["code", "productName", "total", { name: "graders", children: ["fullName", "points"] }] },
    ];
    expect(checkTemplateTags("meeting_score_table", tags)).toEqual({ code: "template_missing_variable", variables: ["dossiers.star"] });
  });

  it("refuses a template without a required loop", () => {
    expect(checkTemplateTags("meeting_score_table", ["meetingTitle", "heldOn", "status"])).toEqual({
      code: "template_missing_variable",
      variables: ["dossiers"],
    });
  });

  it("refuses a section on a plain variable that uses another loop's biến con", () => {
    const tags: TemplateTag[] = [...registration, { name: "entityName", children: ["typeName"] }];
    expect(checkTemplateTags("registration_form", tags)).toEqual({ code: "template_unknown_variable", variables: ["typeName"] });
  });
});
