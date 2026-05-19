"use client";

import { TaskCard } from "./TaskCard";
import type { ApiTask, TaskStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

type Props = {
  status: TaskStatus;
  tasks: ApiTask[];
  onTaskClick: (task: ApiTask) => void;
};

export function StatusColumn({ status, tasks, onTaskClick }: Props) {
  return (
    <section className="flex flex-col bg-surface border border-border rounded-lg p-4 min-h-[200px]">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">{STATUS_LABELS[status]}</h3>
        <span className="text-xs text-muted">{tasks.length}</span>
      </header>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted italic">no tasks</p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} onClick={onTaskClick} />)
        )}
      </div>
    </section>
  );
}
