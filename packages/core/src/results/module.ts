import { defineModule } from "../shared/module";
import { sendCertificateExpiryReminders } from "./certificate-expiry";
import { removeExpiredFiveStarPackages } from "./five-star-package";

export const resultsModule = defineModule({
  jobs: {
    // L16 (#86): nhắc Giấy chứng nhận sắp hết hiệu lực, daily; a giấy whose day has passed unreminded goes out on the next
    // run, and the ledger keeps it to one reminder per ngày hết hiệu lực.
    "results.certificate-expiry-reminders": { cron: "0 8 * * *", run: sendCertificateExpiryReminders },
    // L17 SO-04 (#89): delete the Gói đề nghị 5 sao past their hạn tải, hourly. This job, not a bucket lifecycle rule
    // (domestic S3 may lack one), is what removes them; downloads are refused from `expiresAt` either way.
    "results.five-star-packages-expire": {
      cron: "17 * * * *",
      run: (deps) => {
        const remove = removeExpiredFiveStarPackages(deps);
        return async (system) => {
          while ((await remove(system)).removed > 0);
        };
      },
    },
  },
});
