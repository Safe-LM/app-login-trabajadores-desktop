'use client'

import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import type { TendenciaDia } from '@/lib/types'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTheme } from '@/lib/theme-context'

interface Props { data: TendenciaDia[] }

const CustomTooltip = ({ active, payload, label, isDark }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: isDark ? 'rgba(22,27,34,0.95)' : 'rgba(255,255,255,0.97)',
      border: `1px solid ${isDark ? 'rgba(240,246,252,0.12)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      color: isDark ? '#f0f6fc' : '#0f172a',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    }}>
      <p style={{ color: isDark ? '#8b949e' : '#64748b', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span style={{ fontWeight: 700 }}>{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function TrendChart({ data }: Props) {
  const { isDark } = useTheme()
  const dimColor  = isDark ? '#8b949e' : '#64748b'
  const gridColor = isDark ? 'rgba(240,246,252,0.06)' : 'rgba(0,0,0,0.07)'

  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.fecha), 'EEE d', { locale: es }),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="label" tick={{ fill: dimColor, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: dimColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<CustomTooltip isDark={isDark} />} />
        <Legend wrapperStyle={{ fontSize: 11, color: dimColor }} iconType="circle" iconSize={8} />
        <Line type="monotone" dataKey="entradas" name="Entradas" stroke="#00d2ff" strokeWidth={2} dot={{ fill: '#00d2ff', r: 3 }} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="salidas"  name="Salidas"  stroke="#3a86ff" strokeWidth={2} dot={{ fill: '#3a86ff', r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
