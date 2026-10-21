/**
 * An uploaded file (DC-03). Bytes live in object storage under `storageKey`; only the database
 * status decides who may download it (no object copies between "folders", see L24).
 */
export type FileStatus = "awaiting_upload" | "scanning" | "clean" | "blocked";

/** What a file is for; it decides which Vai trò may upload it (see `uploads.ts`). */
export const FILE_PURPOSES = ["test_upload", "legal_document", "evidence", "signed_ward_report", "council_decision", "grading_evidence", "advisory_attachment", "unlock_request"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];
/** Every purpose a stored file may have: the uploadable ones, and văn bản the server generates (#37). */
export type StoredFilePurpose = FilePurpose | "generated_document";

export interface StoredFile {
  id: string;
  ownerUserId: string;
  purpose: StoredFilePurpose;
  storageKey: string;
  fileName: string;
  declaredType: string;
  size: number;
  multipartUploadId: string | null;
  status: FileStatus;
  detectedType: string | null;
  sha256: string | null;
  blockReason: string | null;
  createdAt: Date;
  uploadedAt: Date | null;
  scannedAt: Date | null;
}

export interface FileRepo {
  insert(f: StoredFile): Promise<void>;
  findById(id: string): Promise<StoredFile | null>;
  update(id: string, patch: Partial<Omit<StoredFile, "id" | "ownerUserId" | "createdAt">>): Promise<void>;
  /** Applies the patch only while the file is still in `expected`; false when another request got there first. */
  updateIfStatus(id: string, expected: FileStatus, patch: Partial<Omit<StoredFile, "id" | "ownerUserId" | "createdAt">>): Promise<boolean>;
  listByOwner(userId: string, limit: number): Promise<StoredFile[]>;
}

/** Allowed types: MIME → accepted extensions. Mirrors what minh chứng needs (PDF, images, Office, short video). */
export const DEFAULT_ALLOWED_TYPES: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "video/mp4": ["mp4"],
};
