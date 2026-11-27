import { auditModule } from "./audit/module";
import { dossiersModule } from "./dossiers/module";
import { resultsModule } from "./results/module";
import { roundsModule } from "./rounds/module";
import { mergeTables } from "./shared/tables";

/** The jobs every module declares, by queue name. */
export const JOBS = mergeTables("job", [auditModule.jobs, roundsModule.jobs, dossiersModule.jobs, resultsModule.jobs]);
export type JobName = keyof typeof JOBS;
export const JOB_NAMES = Object.keys(JOBS) as JobName[];
