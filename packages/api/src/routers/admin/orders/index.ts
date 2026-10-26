import { byId } from "./by-id";
import { fromRequest } from "./from-request";
import { list } from "./list";
import { remove } from "./remove";
import {
  cancel,
  decline,
  extendPayment,
  reopen,
  requestBalance,
  terms,
} from "./stages";
import { update } from "./update";

export const adminOrdersRouter = {
  list,
  byId,
  fromRequest,
  update,
  terms,
  decline,
  reopen,
  requestBalance,
  extendPayment,
  cancel,
  remove,
};
