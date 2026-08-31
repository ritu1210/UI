// Register the Chart.js pieces used across dashboards (import once).
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

ChartJS.register(
  ArcElement,
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Tooltip,
)

ChartJS.defaults.font.family = "Inter, 'Segoe UI', system-ui, sans-serif"
ChartJS.defaults.color = '#64748b'

export const UTIL_COLORS = { bench: '#b9cdea', under: '#6699de', healthy: '#0b5ed7', over: '#0a2e6b' }
export const BU_PALETTE = ['#0b5ed7', '#2f7ff0', '#0a2e6b', '#6699de', '#0f2350', '#89b0e6', '#1b4f9c', '#b9cdea', '#3d6fc0', '#5b8def']

export function utilBand(util) {
  if (util <= 0) return 'bench'
  if (util < 80) return 'under'
  if (util <= 100) return 'healthy'
  return 'over'
}
