import { archive } from "./archive";
import { byNumber } from "./by-number";
import { list } from "./list";
import { remove } from "./remove";

export const adminRequestsRouter = {
  list,
  byNumber,
  archive,
  remove,
};
