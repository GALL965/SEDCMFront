const STATUS_MAP = {
  Normal: 'estable',
  Warning: 'peligro',
  Critico: 'critico',
  'Cr\u00edtico': 'critico',
  OFFLINE: 'offline',
  estable: 'estable',
  peligro: 'peligro',
  critico: 'critico',
  offline: 'offline'
}

const STATUS_PRIORITY = {
  offline: 4,
  critico: 3,
  peligro: 2,
  estable: 1
}

export function normalizeBackendStatus(status) {
  return STATUS_MAP[status] || 'estable'
}

export const normalizeStatus = normalizeBackendStatus

export function getRackEnvironmentStatus(rack) {
  return normalizeBackendStatus(rack?.environmentStatus || rack?.status)
}

export function getWorstNodeStatus(rack) {
  const statuses = (rack?.servers || []).map(server => normalizeBackendStatus(server?.status))

  let strongest = 'estable'

  for (const status of statuses) {
    if ((STATUS_PRIORITY[status] || 0) > (STATUS_PRIORITY[strongest] || 0)) {
      strongest = status
    }
  }

  return strongest
}

export function getAggregatedRackStatus(rack) {
  const statuses = [
    getRackEnvironmentStatus(rack),
    getWorstNodeStatus(rack)
  ]

  let strongest = 'estable'

  for (const status of statuses) {
    if ((STATUS_PRIORITY[status] || 0) > (STATUS_PRIORITY[strongest] || 0)) {
      strongest = status
    }
  }

  return strongest
}

function makeServerFromNode(node, rackCode, createMetrics) {
  const initialMetrics = createMetrics()
  const nodeId = node.node_id || 'node'

  return {
    id: `node-${rackCode}-${nodeId}`,
    name: nodeId,
    host: node.source_type || 'backend',
    status: normalizeBackendStatus(node.health_status),
    sourceType: node.source_type || null,
    firstSeenAt: node.first_seen_at || null,
    lastSeenAt: node.last_seen_at || null,
    metrics: initialMetrics,
    metricsHistory: [initialMetrics]
  }
}

function makeRackFromBackend(rack, createMetrics) {
  const rackCode = rack.rack_code || 'rack'

  return {
    id: `rack-${rackCode}`,
    name: `Rack ${rackCode}`,
    code: rackCode,
    status: normalizeBackendStatus(rack.environment_status),
    environmentStatus: normalizeBackendStatus(rack.environment_status),
    firstSeenAt: rack.first_seen_at || null,
    lastSeenAt: rack.last_seen_at || null,
    servers: (rack.nodes || []).map(node => makeServerFromNode(node, rackCode, createMetrics))
  }
}

function makeZoneFromBackend(zone, createMetrics) {
  const zoneCode = zone.zone_code || 'zona'

  return {
    id: `zone-${zoneCode}`,
    name: `Zona ${zoneCode}`,
    code: zoneCode,
    firstSeenAt: zone.first_seen_at || null,
    lastSeenAt: zone.last_seen_at || null,
    controls: { hvac: 50, extractor: 50 },
    racks: (zone.racks || []).map(rack => makeRackFromBackend(rack, createMetrics))
  }
}

export function mapInventoryToZones(inventory, createMetrics) {
  if (!inventory || !Array.isArray(inventory.zones) || inventory.zones.length === 0) {
    throw new Error('Inventario backend vacio o invalido')
  }

  return inventory.zones.map(zone => makeZoneFromBackend(zone, createMetrics))
}
