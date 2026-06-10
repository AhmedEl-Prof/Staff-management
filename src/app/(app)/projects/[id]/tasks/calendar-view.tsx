import Link from "next/link";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/types/database";

// Month calendar of tasks keyed by due date. Server-rendered: month
// navigation is plain links (?view=calendar&month=YYYY-MM). The work week
// starts on Saturday (Egypt).
const WEEK_START_DOW = 6; // getUTCDay(): 6 = Saturday

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return iso(d).slice(0, 7);
}

// All grid days covering the month, padded to full Sat→Fri weeks.
function gridDays(month: string): string[] {
  const first = new Date(`${month}-01T00:00:00Z`);
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - ((first.getUTCDay() - WEEK_START_DOW + 7) % 7));

  const days: string[] = [];
  const cursor = new Date(start);
  // Always render 6 weeks: a stable grid avoids layout jumps between months.
  for (let i = 0; i < 42; i++) {
    days.push(iso(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function CalendarView({
  tasks,
  projectId,
  month,
  today,
  locale,
}: {
  tasks: TaskRow[];
  projectId: string;
  month: string;
  today: string;
  locale: string;
}) {
  const byDay = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    if (!task.due_date) continue;
    const list = byDay.get(task.due_date) ?? [];
    list.push(task);
    byDay.set(task.due_date, list);
  }

  const days = gridDays(month);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
  const dayNames = days
    .slice(0, 7)
    .map((d) =>
      new Intl.DateTimeFormat(locale, {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${d}T00:00:00Z`)),
    );

  const navHref = (m: string) =>
    `/projects/${projectId}/tasks?view=calendar&month=${m}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={navHref(shiftMonth(month, -1))}
          className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
          aria-label="previous month"
        >
          <ChevronRight className="size-4 rtl:block ltr:hidden" />
          <ChevronLeft className="size-4 rtl:hidden ltr:block" />
        </Link>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <Link
          href={navHref(shiftMonth(month, 1))}
          className="hover:bg-muted inline-flex size-9 items-center justify-center rounded-md"
          aria-label="next month"
        >
          <ChevronLeft className="size-4 rtl:block ltr:hidden" />
          <ChevronRight className="size-4 rtl:hidden ltr:block" />
        </Link>
      </div>

      {/* The grid needs ~700px to breathe; on phones it scrolls horizontally. */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
            {dayNames.map((name) => (
              <div key={name} className="p-2">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = monthOf(day) === month;
              const dayTasks = byDay.get(day) ?? [];
              return (
                <div
                  key={day}
                  className={cn(
                    "flex min-h-24 flex-col gap-1 border-b border-e p-1.5",
                    !inMonth && "bg-muted/30 opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "self-start rounded-full px-1.5 text-xs",
                      day === today
                        ? "bg-primary font-bold text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                    dir="ltr"
                  >
                    {Number(day.slice(8, 10))}
                  </span>
                  {dayTasks.map((task) => (
                    <Link
                      key={task.id}
                      href={`/projects/${projectId}/tasks/${task.id}`}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 text-xs hover:opacity-80",
                        task.status === "done"
                          ? "bg-green-600/15 text-green-700 line-through dark:text-green-400"
                          : task.status === "cancelled"
                            ? "bg-muted text-muted-foreground line-through"
                            : task.due_date && task.due_date < today
                              ? "bg-destructive/15 text-destructive"
                              : "bg-primary/10 text-primary",
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
