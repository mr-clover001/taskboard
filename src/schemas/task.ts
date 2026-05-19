import { z } from "zod";

export const taskStatuses = ["todo", "in_progress", "review", "done"] as const;
export const taskStatusSchema = z.enum(taskStatuses);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  status: taskStatusSchema.optional(),
  assigneeId: z.string().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  assigneeId: z.string().nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
