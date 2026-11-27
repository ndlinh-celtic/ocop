import { defineModule } from "../shared/module";
import { sendDueReminders } from "./reminders";

export const dossiersModule = defineModule({
  jobs: {
    // L03 CT-12: nhắc hạn by calendar day in Vietnam. Hourly in office hours so a missed run catches up the same day;
    // each mốc goes out once however often it runs.
    "dossiers.due-reminders": { cron: "0 8-20 * * *", run: sendDueReminders },
  },
});
