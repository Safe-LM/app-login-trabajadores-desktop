'use client'

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useTheme } from '@/lib/theme-context'

interface DataItem { name: string; value: number }
interface Props { data: DataItem[]; colors: string[]; height?: number }

const CustomTooltip = ({ active, payload, isDark, total }: any) => {
  if (!active || !payload?.length) return null
  const item  = payload[0]
  const pct   = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
  return (
    <div style={{
      background: isDark ? 'rgba(15,20,30,0.97)' : 'rgba(255,255,255,0.98)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      color: isDark ? '#f0f6fc' : '#0f172a',
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.payload.fill, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>{item.name}</span>
      </div>
      <div style={{ marginTop: 4, paddingLeft: 18, color: isDark ? '#8b949e' : '#64748b' }}>
        {item.value} registros · <span style={{ color: item.payload.fill, fontWeight: 700 }}>{pct}%</span>
      </div>
    </div>
  )
}

// Custom legend row debajo del donut
function CustomLegend({ data, colors, total, isDark }: {
  data: DataItem[]; colors: string[]; total: number; isDark: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
      {data.map((item, i) => {
        const pct  = total > 0 ? (item.value / total) * 100 : 0
        const color = colors[i % colors.length]
        return (
          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Color dot */}
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {/* Label */}
            <span style={{ fontSize: 12, color: isDark ? '#c9d1d9' : '#374151', flex: 1, textTransform: 'capitalize' }}>
              {item.name}
            </span>
            {/* Bar */}
            <div style={{ width: 80, height: 5, borderRadius: 99, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width 0.5s ease' }} />
            </div>
            {/* Value + pct */}
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>
              {pct.toFixed(0)}%
            </span>
            <span style={{ fontSize: 11, color: isDark ? '#484f58' : '#94a3b8', minWidth: 24, textAlign: 'right' }}>
              {item.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function DonutChart({ data, colors, height = 200 }: Props) {
  const { isDark } = useTheme()
  const total = data.reduce((s, d) => s + d.value, 0)

  // Centro del donut: texto con el total
  const CenterLabel = ({ viewBox }: any) => {
    if (!viewBox) return null
    const { cx, cy } = viewBox
    return (
      <g>
        <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
          fill={isDark ? '#f0f6fc' : '#0f172a'}
          fontSize={22} fontWeight={700} fontFamily="'JetBrains Mono', monospace">
          {total}
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" dominantBaseline="middle"
          fill={isDark ? '#484f58' : '#94a3b8'}
          fontSize={10} fontWeight={500}>
          TOTAL
        </text>
      </g>
    )
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            dataKey="value"
            startAngle={90}
            endAngle={-270}
            strokeWidth={2}
            stroke={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.8)'}
          >
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={colors[i % colors.length]}
              />
            ))}
            {/* @ts-ignore — recharts acepta label como función o componente */}
            <CenterLabel />
          </Pie>
          <Tooltip content={<CustomTooltip isDark={isDark} total={total} />} />
        </PieChart>
      </ResponsiveContainer>

      <CustomLegend data={data} colors={colors} total={total} isDark={isDark} />
    </div>
  )
}
