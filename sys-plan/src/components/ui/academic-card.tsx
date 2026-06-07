import * as React from "react"

export function AcademicCard({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-card text-card-foreground rounded-[4px] border border-primary shadow-[1px_1px_0px_0px_hsl(var(--primary))] overflow-hidden ${className || ""}`}
      {...props}
    >
      {children}
    </div>
  )
}
