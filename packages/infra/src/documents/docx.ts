import type { DocumentRenderer, DocumentTemplate, TemplateInspection, TemplateTag } from "@ocop/core";
import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module.js";
import PizZip from "pizzip";
import { EMBEDDED_TEMPLATES } from "./templates.generated";

export type TemplateSet = Record<DocumentTemplate, Uint8Array>;

/** The templates shipped with the app (templates/*.docx, embedded at build time). */
export function builtInTemplates(): TemplateSet {
  const entries = Object.entries(EMBEDDED_TEMPLATES).map(([k, b64]) => [k, new Uint8Array(Buffer.from(b64, "base64"))]);
  return Object.fromEntries(entries) as TemplateSet;
}

const OPTIONS = { paragraphLoop: true, linebreaks: true, nullGetter: () => "" };

interface StructuredTag {
  value: string;
  subparsed?: StructuredTag[];
}

const toTags = (tags: StructuredTag[]): TemplateTag[] => tags.map((t) => (t.subparsed ? { name: t.value, children: toTags(t.subparsed) } : t.value));

interface TemplateErrorDetail {
  properties?: { explanation?: string; errors?: TemplateErrorDetail[] };
  message?: string;
}

/**
 * DocumentRenderer on docxtemplater: {tag} placeholders, {#list}…{/list} loops (a loop opened and closed in
 * one table row repeats the row). A missing value prints as empty rather than "undefined". `render` fills the
 * source it is given (a Mẫu văn bản uploaded as a phiên bản, #82), else the built-in template of the loại.
 */
export function docxRenderer(templates: TemplateSet = builtInTemplates()): DocumentRenderer {
  return {
    async render(template, data, source) {
      const doc = new Docxtemplater(new PizZip(source ?? templates[template]), OPTIONS);
      doc.render(data);
      return doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
    },

    inspect(source): TemplateInspection {
      let zip: PizZip;
      try {
        zip = new PizZip(source);
      } catch {
        return { ok: false, error: "not_docx" };
      }
      if (!zip.file("word/document.xml")) return { ok: false, error: "not_docx" };
      const inspector = new InspectModule();
      try {
        // A broken upload is the Quản trị's to fix, told through the details: not an error for the server log.
        new Docxtemplater(zip, { ...OPTIONS, errorLogging: false, modules: [inspector] });
      } catch (e) {
        const err = e as TemplateErrorDetail;
        const details = (err.properties?.errors ?? [err]).map((x) => x.properties?.explanation ?? x.message ?? "lỗi không rõ");
        return { ok: false, error: "syntax", details };
      }
      return { ok: true, tags: toTags(inspector.getAllStructuredTags() as unknown as StructuredTag[]) };
    },

    builtIn(template) {
      return templates[template];
    },
  };
}
