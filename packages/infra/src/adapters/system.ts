import { v7 as uuidv7 } from "uuid";
import type { Clock, IdGen } from "@ocop/core";

export const systemClock: Clock = { now: () => new Date() };

export const uuidV7Gen: IdGen = { next: () => uuidv7() };
