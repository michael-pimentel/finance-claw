interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color: string
}

export default function Sparkline({ data, width = 88, height = 18, color }: SparklineProps) {
  if (data.length < 2) {
    return <svg width={width} height={height} className="sparkline" />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2

  const points = data
    .map((v, i) => {
      const x = ((i / (data.length - 1)) * (width - pad * 2) + pad).toFixed(1)
      const y = (height - pad - ((v - min) / range) * (height - pad * 2)).toFixed(1)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="sparkline">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  )
}
