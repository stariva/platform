import { CreatePostSchema, Post } from "@stariva/db";

import { adminProcedure } from "../../orpc";

/**
 * Create a new post — admin only (any customer can sign in to this API).
 *
 * @example client.post.create({ title: "Hello", content: "World" })
 */
export const create = adminProcedure
  .input(CreatePostSchema)
  .handler(async ({ context, input }) => {
    const [post] = await context.db.insert(Post).values(input).returning();
    return post;
  });
