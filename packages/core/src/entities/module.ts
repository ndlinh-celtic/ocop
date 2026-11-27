import { defineModule } from "../shared/module";
import { addLegalDocument, downloadLegalDocument, getLegalStanding } from "./legal-documents";
import { revealPersonalId, updateEntity } from "./profile";
import { getEntity, listEntities } from "./read";
import { registerEntity } from "./register";
import { changeRepresentativeEmail, createEntity } from "./ward-support";

export const entitiesModule = defineModule({
  useCases: {
    register: registerEntity,
    getEntity,
    listEntities,
    getLegalStanding,
    addLegalDocument,
    downloadLegalDocument,
    updateEntity,
    revealPersonalId,
    createEntity,
    changeRepresentativeEmail,
  },
});
