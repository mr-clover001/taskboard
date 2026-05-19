"use client";

import type { ApiTask } from "@/types";

type Props = {
  task: ApiTask;
  onClick?: (task: ApiTask) => void;
};

export function TaskCard({ task, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className="w-full text-left bg-bg border border-border rounded-md p-3 hover:border-accent transition"
    >
      <p className="text-sm font-medium leading-snug mb-2">{task.title}</p>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {task.assignee ? task.assignee.name : "unassigned"}
        </span>
      </div>
    </button>
  );
}
