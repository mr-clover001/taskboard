import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskCard } from "@/components/TaskCard";
import type { ApiTask } from "@/types";

const baseTask: ApiTask = {
  id: "t_1",
  projectId: "p_1",
  title: "Set up analytics",
  description: null,
  status: "todo",
  assigneeId: "u_1",
  createdById: "u_1",
  position: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  assignee: { id: "u_1", name: "Meera Iyer", email: "meera@taskboard.dev" },
};

describe("<TaskCard />", () => {
  it("renders the task title and assignee", () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText("Set up analytics")).toBeInTheDocument();
    expect(screen.getByText("Meera Iyer")).toBeInTheDocument();
  });

  it("falls back to 'unassigned' when there is no assignee", () => {
    render(<TaskCard task={{ ...baseTask, assignee: null, assigneeId: null }} />);
    expect(screen.getByText("unassigned")).toBeInTheDocument();
  });

  it("invokes onClick with the task when clicked", () => {
    const onClick = vi.fn();
    render(<TaskCard task={baseTask} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledWith(baseTask);
  });
});
