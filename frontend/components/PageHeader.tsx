import { ReactNode } from "react";

export default function PageHeader({
  title,
  description,
  actions,
  tabs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight text-zinc-900 leading-tight">{title}</h1>
          {description && (
            <p className="text-[13px] text-zinc-500 mt-1">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {tabs && <div className="mt-5">{tabs}</div>}
    </div>
  );
}
