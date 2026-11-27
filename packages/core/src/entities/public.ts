// The public interface of the entities module: what apps/web, apps/worker and packages/infra may use, re-exported by src/index.ts.
export {
  assertIdentifierShape,
  ENTITY_KIND_LABEL,
  ENTITY_KINDS,
  entityNotFound,
  maskPersonalId,
  normalizeIdentifier,
  parseDetails,
  type Entity,
  type EntityDetails,
  type EntityKind,
  type EntityRepo,
} from "./model";
export type { EntityDetailView, EntityView } from "./read";
export type { NewEntityInput, RegisterEntityInput } from "./register";
export type { UpdateEntityInput } from "./profile";
export {
  isExpired,
  legalDocumentNotFound,
  legalStanding,
  type LegalDocument,
  type LegalDocumentRecord,
  type LegalDocumentRepo,
  type LegalDocumentType,
  type LegalStanding,
  type Requirement,
  type RequirementState,
} from "./legal";
export type { AddLegalDocumentInput, LegalDocumentView, LegalStandingView } from "./legal-documents";
