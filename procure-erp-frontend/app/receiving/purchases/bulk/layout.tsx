import type React from "react"
export default function BulkPurchaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">一括仕入処理</h2>
      </div>
      {children}
    </div>
  )
}

