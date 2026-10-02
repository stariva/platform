import { byId } from "./by-id";
import { grantAccess } from "./grant-access";
import { list } from "./list";
import { remove } from "./remove";
import { revokeAccess } from "./revoke-access";
import { revokeSessions } from "./revoke-sessions";
import { search } from "./search";
import { update } from "./update";

export const adminUsersRouter = {
  list,
  byId,
  search,
  update,
  grantAccess,
  revokeAccess,
  revokeSessions,
  remove,
};
