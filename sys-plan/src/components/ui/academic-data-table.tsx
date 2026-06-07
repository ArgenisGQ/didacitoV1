import * as React from "react"

export function AcademicDataTable({ children, className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full rounded-[4px] border border-primary/40 overflow-hidden">
      <table className={`w-full caption-bottom text-sm ${className || ""}`} {...props}>
        {children}
      </table>
    </div>
  )
}

export function AcademicDataTableHeader({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`bg-gradient-to-b from-primary/10 to-transparent border-b border-primary/40 ${className || ""}`} {...props}>
      {children}
    </thead>
  )
}

export function AcademicDataTableRow({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`border-b border-primary/20 transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted ${className || ""}`} {...props}>
      {children}
    </tr>
  )
}

export function AcademicDataTableCell({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className || ""}`} {...props}>
      {children}
    </td>
  )
}
