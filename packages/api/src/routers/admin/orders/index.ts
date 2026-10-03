import { byId } from "./by-id";
import { list } from "./list";
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
  update,
  terms,
  decline,
  reopen,
  requestBalance,
  extendPayment,
  cancel,
};
