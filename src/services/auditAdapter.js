const CRITICAL_ACK_STATUSES = new Set(['FAILED', 'TIMEOUT', 'REJECTED', 'NACK'])
const WARNING_ACK_STATUSES = new Set(['PENDING', 'SENT', 'ISSUED'])

function normalizeAckStatus(status) {
  return String(status || 'UNKNOWN').trim().toUpperCase()
}

function mapLevel(ackStatus) {
  const normalized = normalizeAckStatus(ackStatus)

  if (CRITICAL_ACK_STATUSES.has(normalized)) return 'critical'
  if (WARNING_ACK_STATUSES.has(normalized)) return 'warn'
  return 'info'
}

export function mapAuditCommandsToLogs(auditCommands) {
  const items = Array.isArray(auditCommands?.items) ? auditCommands.items : []

  return items.map(command => {
    const ackStatus = normalizeAckStatus(command.ack_status)
    const node = command.node_id || 'rack'
    const rack = command.rack_code || 'sin rack'
    const reason = command.reason || 'sin razon'

    return {
      t: command.issued_at ? new Date(command.issued_at).getTime() : Date.now(),
      level: mapLevel(ackStatus),
      text: `Comando ${command.action || 'desconocido'} para ${node} en ${rack}: ${reason}. ACK: ${ackStatus}`
    }
  })
}
