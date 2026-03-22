'use client'

import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'
import type { SucursalCount } from '@/lib/types'
import { useTheme } from '@/lib/theme-context'

interface Props { data: SucursalCount[] }

const CustomTooltip = ({ active, payload, isDark }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: isDark ? 'rgba(22,27,34,0.95)' : 'rgba(255,255,255,0.97)',
      border: `1px solid ${isDark ? 'rgba(240,246,252,0.12)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      color: isDark ? '#f0f6fc' : '#0f172a',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      <p style={{ color: isDark ? '#8b949e' : '#64748b', marginBottom: 2 }}>
        {payload[0].payload.sucursal}
      </p>
      <p style={{ color: '#00d2ff' }}>
        Entradas: <span style={{ fontWeight: 700 }}>{payload[0].value}</span>
      </p>
    </div>
  )
}

export default function SucursalChart({ data }: Props) {
  const { isDark } = useTheme()
  const dimColor   = isDark ? '#8b949e' : '#64748b'
  const labelColor = isDark ? '#f0f6fc' : '#0f172a'
  const gridColor  = isDark ? 'rgba(240,246,252,0.06)' : 'rgba(0,0,0,0.07)'
  const cursorFill = isDark ? 'rgba(240,246,252,0.04)' : 'rgba(0,0,0,0.04)'
  const maxVal = Math.max(...data.map((d) => d.total), 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
        <XAxis type="number" tick={{ fill: dimColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="sucursal" tick={{ fill: labelColor, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
        <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: cursorFill }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((entry, i) => (
            <Cell key={i} fill={`rgba(0,210,255,${0.4 + 0.6 * (entry.total / maxVal)})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
