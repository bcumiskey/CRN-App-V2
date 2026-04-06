import { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  // V2 pattern
  action?: {
    label: string;
    onClick: () => void;
  };
  // V1 pattern (backwards compatible)
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, action, actionLabel, onAction }: EmptyStateProps) {
  const label = action?.label ?? actionLabel;
  const onClick = action?.onClick ?? onAction;

  return (
    <div className="text-center py-12">
      {icon && <div className="flex justify-center mb-4 text-gray-300">{icon}</div>}
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {label && onClick && (
        <Button onClick={onClick} variant="primary" size="sm">
          {label}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
