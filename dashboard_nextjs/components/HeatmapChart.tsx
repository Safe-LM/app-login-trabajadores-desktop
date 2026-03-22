'use client'

interface Cell {
  dia: string
  hora: number
  total: number
}

interface Props {
  data: Cell[]
}

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const HORAS = Array.from({ length: 18 }, (_, i) => i + 5) // 05:00 → 22:00

function cellColor(val: number, max: number): string {
  if (val === 0 || max === 0) return 'rgba(255,255,255,0.04)'
  const t = val / max
  // deep blue → cyan
  const r = Math.round(0 + t * 0)
  const g = Math.round(100 + t * 110)
  const b = Math.round(200 + t * 55)
  return `rgba(${r},${g},${b},${0.15 + t * 0.7})`
}

export default function HeatmapChart({ data }: Props) {
  const max = Math.max(...data.map((d) => d.total), 1)

  const get = (dia: string, hora: number) =>
    data.find((d) => d.dia === dia && d.hora === hora)?.total ?? 0

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Hour labels */}
        <div className="flex mb-1 ml-10">
          {HORAS.map((h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-[#484f58] mono">
              {h}h
            </div>
          ))}
        </div>

        {/* Rows */}
        {DIAS.map((dia) => (
          <div key={dia} className="flex items-center mb-1">
            <span className="w-10 text-[10px] text-[#8b949e] shrink-0">{dia}</span>
            {HORAS.map((hora) => {
              const val = get(dia, hora)
              return (
                <div
                  key={hora}
                  className="flex-1 aspect-square mx-px rounded-[3px] transition-all cursor-default relative group"
                  style={{ background: cellColor(val, max) }}
                  title={`${dia} ${hora}:00 — ${val} entradas`}
                >
                  {val > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[8px] font-bold text-white">{val}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-[10px] text-[#484f58]">0</span>
          <div className="flex gap-px">
            {[0.1, 0.3, 0.5, 0.7, 0.9, 1].map((t) => (
              <div
                key={t}
                className="w-5 h-3 rounded-sm"
                style={{ background: cellColor(Math.round(t * max), max) }}
              />
            ))}
          </div>
          <span className="text-[10px] text-[#484f58]">{max}</span>
        </div>
      </div>
    </div>
  )
}
