import { z } from "zod";

export const principalSchema = z.object({
  userId: z.string(),
});

export const rls = [];
