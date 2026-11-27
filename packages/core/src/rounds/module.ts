import { defineModule } from "../shared/module";
import { closeDueSubmissions } from "./close-due";

export const roundsModule = defineModule({
  jobs: {
    // L07: a round Đang nhận nộp closes within a minute after Hạn nộp xã (23:59:59 Vietnam time).
    "rounds.close-due": { cron: "* * * * *", run: closeDueSubmissions },
  },
});
