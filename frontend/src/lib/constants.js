export const APP_NAME = 'STET SYSTEUR'
export const APP_TAGLINE = 'Manage your resources'
// Displayed as the signed-in user until real authentication is added.
export const CURRENT_USER = 'Ritu Mehta'

export const MONTHS = [
  'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026',
  'Jul 2026', 'Aug 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dec 2026',
]

// Months available for new/edited allocations: current month onward only.
export function allocatableMonths() {
  const now = new Date()
  return MONTHS.filter((m) => {
    const dt = new Date(m + ' 1')
    return dt.getFullYear() > now.getFullYear() ||
      (dt.getFullYear() === now.getFullYear() && dt.getMonth() >= now.getMonth())
  })
}

export function userInitials(name = CURRENT_USER) {
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}
