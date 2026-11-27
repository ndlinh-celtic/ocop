import { defineModule } from "../shared/module";
import { listWards } from "./catalogue";

export const orgModule = defineModule({
  useCases: {
    listWards,
  },
});
