import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number;
  icon?: ReactNode;
  color?: string;
  suffix?: string;
}

export function StatCard({ label, value, icon, color, suffix = "" }: StatCardProps) {
  return (
    <div className="stat-card">
      {icon && (
        <div
          className="stat-card__icon"
          data-color={color ? "true" : undefined}
          style={color ? { borderColor: color, color } : undefined}
        >
          {icon}
        </div>
      )}
      <div>
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">
          {value.toLocaleString()}
          {suffix ? <span>{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}
