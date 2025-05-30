import type React from "react"
export default function EmployeeNewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <main className="flex-1 overflow-y-auto bg-muted/20">{children}</main>
}

