import { defineModule } from "../shared/module";
import { notifyFileBlocked, scanUploadedFile } from "./scan";
import { completeUpload, listFiles, requestDownload, requestUpload } from "./uploads";

export const filesModule = defineModule({
  useCases: {
    requestUpload,
    completeUpload,
    requestDownload,
    list: listFiles,
  },
  consumers: {
    "files.scan": { events: ["files.uploaded"], handle: scanUploadedFile },
    "notifications.file-blocked": { events: ["files.blocked"], handle: notifyFileBlocked },
  },
});
