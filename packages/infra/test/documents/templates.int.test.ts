import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { builtInTemplates } from "../../src/documents/docx";
import { TEMPLATE_FILES } from "../../src/documents/template-files";

describe("Word templates (#37)", () => {
  it.each(Object.entries(TEMPLATE_FILES))("the embedded %s is the one in templates/ (run templates:embed after editing it)", async (template, file) => {
    const onDisk = await readFile(path.resolve(import.meta.dirname, "../../templates", file));
    expect(Buffer.from(builtInTemplates()[template as keyof typeof TEMPLATE_FILES]).equals(onDisk)).toBe(true);
  });
});
