import { eq, user } from "@stariva/db";
import { profileFormSchema } from "@stariva/validators";

import { protectedProcedure } from "../../orpc";

/**
 * Update profile fields: username, bio.
 *
 * Email is intentionally NOT written here: it is the login and the key to
 * admin rights (ADMIN_EMAILS), so it may only change through better-auth's
 * verified change-email flow.
 */
export const updateProfile = protectedProcedure
  .input(profileFormSchema)
  .handler(async ({ context, input }) => {
    await context.db
      .update(user)
      .set({
        username: input.username,
        bio: input.bio,
        updatedAt: new Date(),
      })
      .where(eq(user.id, context.session.user.id));

    return { success: true };
  });
