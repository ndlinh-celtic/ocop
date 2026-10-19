/** What the worker learns from reading a stored file once: hash, real type, and the virus verdict. */
export interface FileInspection {
  sha256: string;
  /** From the file's magic bytes; null when unrecognised. */
  detectedType: string | null;
  /** Signature name when malware was found, null when clean. */
  virus: string | null;
}

export interface FileInspector {
  inspect(storageKey: string): Promise<FileInspection>;
}

const OFFICE = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/** Magic bytes must agree with the declared type; Office files may sniff as plain ZIP. */
export function typeMatches(declared: string, detected: string | null): boolean {
  if (detected === declared) return true;
  return OFFICE.includes(declared) && detected === "application/zip";
}
