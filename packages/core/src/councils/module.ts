import { defineModule } from "../shared/module";
import { assignmentCandidates, editAssignments, listAssignments } from "./assignments";
import { startGrading } from "./grading";
import { createCouncil, setCouncilLeader, updateCouncil } from "./manage";
import { downloadCouncilDecision, getCouncil, listCouncils } from "./read";
import { addAssignment, assignmentHistory, replaceAssignment } from "./replace";

export const councilsModule = defineModule({
  useCases: {
    create: createCouncil,
    update: updateCouncil,
    setLeader: setCouncilLeader,
    list: listCouncils,
    get: getCouncil,
    downloadDecision: downloadCouncilDecision,
    editAssignments,
    assignments: listAssignments,
    assignmentCandidates,
    startGrading,
    replaceAssignment,
    addAssignment,
    assignmentHistory,
  },
});
