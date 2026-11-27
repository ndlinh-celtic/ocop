import { defineModule } from "../shared/module";
import { activateTemplate, downloadTemplate, listTemplates, previewTemplate, uploadTemplate } from "./templates";

export const documentsModule = defineModule({
  useCases: {
    listTemplates,
    downloadTemplate,
    uploadTemplate,
    activateTemplate,
    previewTemplate,
  },
});
