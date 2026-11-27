import { defineModule } from "../shared/module";
import { recordStartup } from "./startup";

import {
  certificateSettings,
  reminderMilestones,
  setCertificateSettings,
  setReminderMilestones,
  setUnderperformingRatio,
  underperformingRatio,
} from "./settings";

export const systemModule = defineModule({
  useCases: {
    recordStartup,
    reminderMilestones,
    setReminderMilestones,
    // L16 Tiêu chí dưới mức (#80).
    underperformingRatio,
    setUnderperformingRatio,
    // L16 HD-11 Giấy chứng nhận (#84).
    certificateSettings,
    setCertificateSettings,
  },
});
