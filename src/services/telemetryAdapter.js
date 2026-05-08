function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toTimestamp(value) {
  const parsed = value ? new Date(value).getTime() : Date.now()
  return Number.isFinite(parsed) ? parsed : Date.now()
}

function sortByTimeAsc(items, timeKey) {
  return [...(items || [])].sort((a, b) => toTimestamp(a[timeKey]) - toTimestamp(b[timeKey]))
}

function bytesPerSecondToMbps(rx, tx) {
  const totalBytesPerSecond = toNumber(rx) + toNumber(tx)
  return Number(((totalBytesPerSecond * 8) / 1000000).toFixed(2))
}

export function mapTelemetryToMetricsHistory({
  nodeTelemetry,
  environmentTelemetry,
  fallbackMetrics
}) {
  const nodeItems = sortByTimeAsc(nodeTelemetry?.items, 'event_time')
  const envItems = sortByTimeAsc(environmentTelemetry?.items, 'event_time')

  if (nodeItems.length === 0 && envItems.length === 0) {
    return []
  }

  const maxLength = Math.max(nodeItems.length, envItems.length)
  const baseMetrics = fallbackMetrics || {}

  return Array.from({ length: maxLength }, (_, index) => {
    const node = nodeItems[index] || nodeItems[nodeItems.length - 1] || null
    const env = envItems[index] || envItems[envItems.length - 1] || null
    const t = node ? toTimestamp(node.event_time) : toTimestamp(env?.event_time)

    return {
      ...baseMetrics,
      t,
      cpu: node ? toNumber(node.cpu_usage_pct, baseMetrics.cpu) : baseMetrics.cpu,
      ram: node ? toNumber(node.ram_usage_mb, baseMetrics.ram) : baseMetrics.ram,
      net: node ? bytesPerSecondToMbps(node.net_rx_bytes_sec, node.net_tx_bytes_sec) : baseMetrics.net,
      temp: env ? toNumber(env.temperature_c, baseMetrics.temp) : baseMetrics.temp,
      humidity: env ? toNumber(env.humidity_pct, baseMetrics.humidity) : baseMetrics.humidity,
      power: baseMetrics.power
    }
  })
}
