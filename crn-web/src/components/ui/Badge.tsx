import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "purple";
}

const variants = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Maps job/invoice/period statuses to badge variants */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    SCHEDULED: { variant: "info", label: "Scheduled" },
    IN_PROGRESS: { variant: "warning", label: "In Progress" },
    COMPLETED: { variant: "success", label: "Completed" },
    INVOICED: { variant: "default", label: "Invoiced" },
    CANCELLED: { variant: "danger", label: "Cancelled" },
    draft: { variant: "default", label: "Draft" },
    sent: { variant: "info", label: "Sent" },
    paid: { variant: "success", label: "Paid" },
    overdue: { variant: "danger", label: "Overdue" },
    void: { variant: "danger", label: "Void" },
    open: { variant: "info", label: "Open" },
    closed: { variant: "warning", label: "Closed" },
    active: { variant: "success", label: "Active" },
    lame_duck: { variant: "warning", label: "Lame Duck" },
    archived: { variant: "default", label: "Archived" },
    inactive: { variant: "default", label: "Inactive" },
  };
  const { variant, label } = map[status] ?? { variant: "default" as const, label: status };
  return <Badge variant={variant}>{label}</Badge>;
}
