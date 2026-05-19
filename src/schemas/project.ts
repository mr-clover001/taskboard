import { z } from "zod";

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
