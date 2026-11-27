import { defineModule } from "../shared/module";
import { configureChecklist } from "./checklist";
import { closeDueSubmissions } from "./close-due";
import { changeAggregationRule, changeGradingMode, endRound } from "./configure";
import { assignCouncil } from "./council";
import { extendDeadline, listDeadlineExtensions } from "./extension";
import { createRound, deleteRound, openRound, updateRound } from "./manage";
import { currentOpenRound, getRound, listRounds } from "./read";

export const roundsModule = defineModule({
  useCases: {
    createRound,
    updateRound,
    deleteRound,
    openRound,
    changeGradingMode,
    changeAggregationRule,
    endRound,
    listRounds,
    getRound,
    currentOpenRound,
    closeDueSubmissions,
    extendDeadline,
    listDeadlineExtensions,
    configureChecklist,
    assignCouncil,
  },
  jobs: {
    // L07: a round Đang nhận nộp closes within a minute after Hạn nộp xã (23:59:59 Vietnam time).
    "rounds.close-due": { cron: "* * * * *", run: closeDueSubmissions },
  },
});
