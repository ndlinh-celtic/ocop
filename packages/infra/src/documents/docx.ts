import type { DocumentRenderer, DocumentTemplate } from "@ocop/core";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { EMBEDDED_TEMPLATES } from "./templates.generated";

export type TemplateSet = Record<DocumentTemplate, Uint8Array>;

/** The templates shipped with the app (templates/*.docx, embedded at build time). */
export function builtInTemplates(): TemplateSet {
  const entries = Object.entries(EMBEDDED_TEMPLATES).map(([k, b64]) => [k, new Uint8Array(Buffer.from(b64, "base64"))]);
  return Object.fromEntries(entries) as TemplateSet;
}

/**
 * DocumentRenderer on docxtemplater: {tag} placeholders, {#list}…{/list} loops (a loop opened and closed in
 * one table row repeats the row). A missing value prints as empty rather than "undefined".
 */
export function docxRenderer(templates: TemplateSet = builtInTemplates()): DocumentRenderer {
  return {
    async render(template, data) {
      const doc = new Docxtemplater(new PizZip(templates[template]), {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => "",
      });
      doc.render(data);
      return doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" });
    },
  };
}
