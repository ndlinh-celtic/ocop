import { anchorAuditChain, sealAuditBatch, verifyAuditChain, verifyAuditChainAsAdmin } from "./audit/chain";
import { searchAudit } from "./audit/search";
import { editDraft } from "./criteria/edit";
import { addNode, moveNode, removeNode } from "./criteria/structure";
import { copyVersion, deleteVersion } from "./criteria/copy";
import { importVersion } from "./criteria/import";
import { publishVersion, validateVersion } from "./criteria/publish";
import { previewSet } from "./criteria/preview";
import { getCriteriaSet, getVersion, listVersions } from "./criteria/read";
import { completeUpload, listFiles, requestDownload, requestUpload } from "./files/uploads";
import { hasTotp, myAssignments, switchActiveRole } from "./identity/active-role";
import { grantRole, revokeRole } from "./identity/assignments";
import { changePassword, requestPasswordReset, resetPassword } from "./identity/passwords";
import { reauthenticate, sensitiveSample } from "./identity/reauth";
import { bootstrapFirstAdmin } from "./identity/bootstrap";
import { listNotifications, markAllRead, markRead, unreadCount } from "./notifications/inbox";
import { listWards } from "./org/catalogue";
import { authenticate, signIn, signOut } from "./identity/session";
import { activateAccount, createStaffUser, describeActivation, listUsers, getUser, resendActivation } from "./identity/staff";
import { confirmTotpEnrollment, pendingSignIn, startTotpEnrollment, verifySignInTotp } from "./identity/totp";
import { handleEvent } from "./platform/consumers";
import { listDeliveries } from "./platform/deliveries";
import { configureChecklist } from "./rounds/checklist";
import { closeDueSubmissions } from "./rounds/close-due";
import { changeAggregationRule, changeGradingMode, endRound } from "./rounds/configure";
import { extendDeadline, listDeadlineExtensions } from "./rounds/extension";
import { createRound, deleteRound, openRound, updateRound } from "./rounds/manage";
import { currentOpenRound, getRound, listRounds } from "./rounds/read";
import type { CoreDeps } from "./shared/deps";
import { recordStartup } from "./system/startup";
import { getEntity, listEntities } from "./entities/read";
import { registerEntity } from "./entities/register";
import { addLegalDocument, downloadLegalDocument, getLegalStanding } from "./entities/legal-documents";
import { revealPersonalId, updateEntity } from "./entities/profile";
import { copyDossier, createDossier, creationOptions } from "./dossiers/create";
import { downloadSubmissionDocument } from "./dossiers/documents";
import { addEvidenceFile, deleteDossier, updateProduct } from "./dossiers/edit";
import { dossierTimeline, getDossier, listDossiers } from "./dossiers/read";
import { listSubmissions, submissionCheck, submitDossier, withdrawDossier } from "./dossiers/submit";
import { changeHandler, listHandlers, receiveDossier } from "./dossiers/ward";
import { assessChecklist, dossierChecklist } from "./dossiers/checklist";
import { explainCriterion, linkEvidence, removeEvidenceFile, selfAssessment, selfScore } from "./dossiers/self-assessment";
import { changeRepresentativeEmail, createEntity } from "./entities/ward-support";

/** The use cases of the core, bound to their dependencies. UI and worker only call these. */
export function createCore(deps: CoreDeps) {
  return {
    identity: {
      bootstrapFirstAdmin: bootstrapFirstAdmin(deps),
      signIn: signIn(deps),
      verifySignInTotp: verifySignInTotp(deps),
      pendingSignIn: pendingSignIn(deps),
      startTotpEnrollment: startTotpEnrollment(deps),
      confirmTotpEnrollment: confirmTotpEnrollment(deps),
      authenticate: authenticate(deps),
      signOut: signOut(deps),
      createStaffUser: createStaffUser(deps),
      resendActivation: resendActivation(deps),
      listUsers: listUsers(deps),
      getUser: getUser(deps),
      describeActivation: describeActivation(deps),
      activateAccount: activateAccount(deps),
      grantRole: grantRole(deps),
      revokeRole: revokeRole(deps),
      myAssignments: myAssignments(deps),
      switchActiveRole: switchActiveRole(deps),
      hasTotp: hasTotp(deps),
      requestPasswordReset: requestPasswordReset(deps),
      resetPassword: resetPassword(deps),
      changePassword: changePassword(deps),
      reauthenticate: reauthenticate(deps),
      sensitiveSample: sensitiveSample(deps),
    },
    org: {
      listWards: listWards(deps),
    },
    notifications: {
      list: listNotifications(deps),
      unreadCount: unreadCount(deps),
      markRead: markRead(deps),
      markAllRead: markAllRead(deps),
      listDeliveries: listDeliveries(deps),
    },
    platform: {
      handleEvent: handleEvent(deps),
    },
    audit: {
      search: searchAudit(deps),
      seal: sealAuditBatch(deps),
      verify: verifyAuditChain(deps),
      anchor: anchorAuditChain(deps),
      verifyAsAdmin: verifyAuditChainAsAdmin(deps),
    },
    files: {
      requestUpload: requestUpload(deps),
      completeUpload: completeUpload(deps),
      requestDownload: requestDownload(deps),
      list: listFiles(deps),
    },
    criteria: {
      importVersion: importVersion(deps),
      listVersions: listVersions(deps),
      getVersion: getVersion(deps),
      getCriteriaSet: getCriteriaSet(deps),
      validateVersion: validateVersion(deps),
      publishVersion: publishVersion(deps),
      previewSet: previewSet(deps),
      editDraft: editDraft(deps),
      addNode: addNode(deps),
      removeNode: removeNode(deps),
      moveNode: moveNode(deps),
      copyVersion: copyVersion(deps),
      deleteVersion: deleteVersion(deps),
    },
    rounds: {
      createRound: createRound(deps),
      updateRound: updateRound(deps),
      deleteRound: deleteRound(deps),
      openRound: openRound(deps),
      changeGradingMode: changeGradingMode(deps),
      changeAggregationRule: changeAggregationRule(deps),
      endRound: endRound(deps),
      listRounds: listRounds(deps),
      getRound: getRound(deps),
      currentOpenRound: currentOpenRound(deps),
      closeDueSubmissions: closeDueSubmissions(deps),
      extendDeadline: extendDeadline(deps),
      listDeadlineExtensions: listDeadlineExtensions(deps),
      configureChecklist: configureChecklist(deps),
    },
    entities: {
      register: registerEntity(deps),
      getEntity: getEntity(deps),
      listEntities: listEntities(deps),
      getLegalStanding: getLegalStanding(deps),
      addLegalDocument: addLegalDocument(deps),
      downloadLegalDocument: downloadLegalDocument(deps),
      updateEntity: updateEntity(deps),
      revealPersonalId: revealPersonalId(deps),
      createEntity: createEntity(deps),
      changeRepresentativeEmail: changeRepresentativeEmail(deps),
    },
    dossiers: {
      creationOptions: creationOptions(deps),
      create: createDossier(deps),
      copy: copyDossier(deps),
      get: getDossier(deps),
      list: listDossiers(deps),
      timeline: dossierTimeline(deps),
      updateProduct: updateProduct(deps),
      addEvidenceFile: addEvidenceFile(deps),
      removeEvidenceFile: removeEvidenceFile(deps),
      linkEvidence: linkEvidence(deps),
      selfScore: selfScore(deps),
      explainCriterion: explainCriterion(deps),
      selfAssessment: selfAssessment(deps),
      delete: deleteDossier(deps),
      submissionCheck: submissionCheck(deps),
      submit: submitDossier(deps),
      withdraw: withdrawDossier(deps),
      submissions: listSubmissions(deps),
      receive: receiveDossier(deps),
      changeHandler: changeHandler(deps),
      handlers: listHandlers(deps),
      downloadSubmissionDocument: downloadSubmissionDocument(deps),
      checklist: dossierChecklist(deps),
      assessChecklist: assessChecklist(deps),
    },
    system: {
      recordStartup: recordStartup(deps),
    },
  };
}

export type Core = ReturnType<typeof createCore>;
