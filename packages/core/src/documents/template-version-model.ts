import type { DocumentTemplate } from "./renderer";

/**
 * A Mẫu văn bản uploaded by the Quản trị (#82): phiên bản `n` of one loại, numbered 1, 2, … per loại. Its file never
 * changes; only which phiên bản is the mẫu đang dùng does. With no `active` phiên bản the loại uses its mẫu mặc định.
 */
export interface TemplateVersion {
  id: string;
  kind: DocumentTemplate;
  n: number;
  fileId: string;
  uploadedBy: string;
  uploadedAt: Date;
  active: boolean;
}

export interface TemplateVersionRepo {
  /** Serialises the writes on one loại until the transaction ends (numbering, mẫu đang dùng). */
  lockKind(kind: DocumentTemplate): Promise<void>;
  /** Newest first. */
  list(kind?: DocumentTemplate): Promise<TemplateVersion[]>;
  findById(id: string): Promise<TemplateVersion | null>;
  active(kind: DocumentTemplate): Promise<TemplateVersion | null>;
  insert(v: TemplateVersion): Promise<void>;
  /** Makes `id` the only active phiên bản of the loại; null leaves none (mẫu mặc định). */
  setActive(kind: DocumentTemplate, id: string | null): Promise<void>;
}
