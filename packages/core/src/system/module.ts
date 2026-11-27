import { defineModule } from "../shared/module";
import { recordStartup } from "./startup";

export const systemModule = defineModule({
  useCases: {
    recordStartup,
  },
});
