import { archive } from "./archive";
import { byNumber } from "./by-number";
import { list } from "./list";

export const adminRequestsRouter = {
  list,
  byNumber,
  archive,
};
