// CSV export — one of the most common complaints about budget apps is the
// inability to get your own data out. Amounts are exported unformatted so
// spreadsheets parse them as numbers.
export function exportTransactionsCsv(transactions, { categoryMap, accountMap, memberMap }) {
  const header = ['Date', 'Description', 'Category', 'Account', 'PaidBy', 'Amount', 'Shared', 'Pending']
  const rows = transactions.map((tx) => [
    tx.date,
    `"${(tx.description || '').replaceAll('"', '""')}"`,
    `"${(categoryMap[tx.categoryId]?.name || 'Uncategorized').replaceAll('"', '""')}"`,
    `"${(accountMap[tx.accountId]?.name || '').replaceAll('"', '""')}"`,
    `"${(memberMap[tx.paidBy]?.displayName || '').replaceAll('"', '""')}"`,
    tx.amount,
    tx.shared ? 'yes' : 'no',
    tx.pending ? 'yes' : 'no',
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `casa-budget-transactions-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
