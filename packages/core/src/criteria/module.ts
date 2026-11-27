import { defineModule } from "../shared/module";
import { copyVersion, deleteVersion } from "./copy";
import { editDraft } from "./edit";
import { importVersion } from "./import";
import { previewSet } from "./preview";
import { publishVersion, validateVersion } from "./publish";
import { getCriteriaSet, getVersion, listVersions } from "./read";
import { addNode, moveNode, removeNode } from "./structure";

export const criteriaModule = defineModule({
  useCases: {
    importVersion,
    listVersions,
    getVersion,
    getCriteriaSet,
    validateVersion,
    publishVersion,
    previewSet,
    editDraft,
    addNode,
    removeNode,
    moveNode,
    copyVersion,
    deleteVersion,
  },
});
