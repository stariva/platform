import { archive } from "./archive";
import { byNumber } from "./by-number";
import { orderDraft } from "./draft";
import { list } from "./list";
import { remove } from "./remove";

export const adminRequestsRouter = {
  list,
  byNumber,
  orderDraft,
  archive,
  remove,
};
