import { auditEntry } from "../audit/audit";
import { authorize } from "../identity/policy";
import { dataScopeOf } from "../identity/scope";
import { emit } from "../platform/emit";
import { vnDateOf } from "../rounds/model";
import type { Actor } from "../shared/context";
import type { CoreDeps } from "../shared/deps";
import { DomainError } from "../shared/errors";
import { assertIdShape } from "../shared/ids";
import { yearOf } from "./certificate";
import { certificateExpiry, validityMonthsOf } from "./certificate-model";
import { numberOf, signedOnOf } from "./decision";

/*
 * L16 HD-11 (#84, spec #79 stories 17, 18, 30): the Cán bộ Sở corrects the số or ngày ký of a recorded Quyết định công
 * nhận, with a lý do. Its Giấy chứng nhận keep their số hiệu and thời hạn hiệu lực; their ngày cấp and ngày hết hiệu lực
 * follow the ngày ký, and the bản nháp of those still Chờ ký is generated again. A ngày ký in another year is refused:
 * the số thứ tự of the giấy belong to the year they were numbered in.
 */

const MAX_REASON = 1000;

export interface AmendDecisionInput {
  decisionId: string;
  number: string;
  signedOn: string;
  reason: string;
}

export function amendDecision(deps: CoreDeps) {
  return async (actor: Actor, input: AmendDecisionInput): Promise<{ number: string; signedOn: string; certificates: number }> => {
    authorize(actor, "results.decision.record");
    const notFound = () => new DomainError("not_found", "Không tìm thấy Quyết định công nhận");
    assertIdShape(input.decisionId, notFound);
    const number = numberOf(input.number);
    const now = deps.clock.now();
    const signedOn = signedOnOf(input.signedOn, vnDateOf(now));
    const reason = typeof input.reason === "string" ? input.reason.trim() : "";
    if (reason === "") throw new DomainError("reason_required", "Nhập lý do sửa quyết định");
    if (reason.length > MAX_REASON) throw new DomainError("field_too_long", "Lý do quá dài");
    return deps.uow.run(async (tx) => {
      const before = await tx.recognitionDecisions.lock(input.decisionId);
      if (!before) throw notFound();
      if (before.number === number && before.signedOn === signedOn) {
        throw new DomainError("decision_unchanged", "Số và ngày ký không thay đổi");
      }
      if (yearOf(signedOn) !== yearOf(before.signedOn)) {
        throw new DomainError("decision_year_change", "Không sửa được ngày ký sang năm khác vì số hiệu giấy chứng nhận đã cấp theo năm của ngày ký");
      }
      await tx.recognitionDecisions.amend(before.id, { number, signedOn });
      const certificates = await tx.certificates.ofDecision(before.id);
      for (const cert of certificates) {
        const redraft = cert.state === "awaiting_signature";
        await tx.certificates.update({
          ...cert,
          issuedOn: signedOn,
          // The giấy keeps the thời hạn it was issued with, not the current setting (#79 review S2).
          expiresOn: certificateExpiry(signedOn, validityMonthsOf(cert.issuedOn, cert.expiresOn)),
          ...(redraft ? { draftFileId: null, templateVersionId: null } : {}),
        });
        if (!redraft) continue;
        const dossier = await tx.dossiers.findById(dataScopeOf(actor), cert.dossierId);
        if (!dossier) throw new Error(`dossier ${cert.dossierId} of certificate ${cert.id} is out of scope`);
        await emit(deps, tx, {
          type: "certificate.amended",
          payload: { certificateId: cert.id, dossierId: cert.dossierId, entityId: dossier.entityId, decisionId: before.id },
        });
      }
      await tx.audit.append(
        auditEntry(actor, deps.ids.next(), now, {
          action: "results.decision.amended",
          targetType: "recognition_decision",
          targetId: before.id,
          before: { number: before.number, signedOn: before.signedOn },
          after: { number, signedOn },
          metadata: { reason, certificates: certificates.map((c) => c.id) },
        }),
      );
      return { number, signedOn, certificates: certificates.length };
    });
  };
}
