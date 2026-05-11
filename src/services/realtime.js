const DEFAULT_WS_URL = 'ws://127.0.0.1:3000/ws'

const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL

function parseEvent(payload) {
  try {
    const parsed = JSON.parse(payload)
    if (!parsed || typeof parsed !== 'object' || !parsed.type) return null
    return parsed
  } catch {
    return null
  }
}

export function connectRealtime({ onEvent, onOpen, onClose, onError }) {
  let socket
  let closedByClient = false
  let retried = false

  function attachSocket() {
    socket = new WebSocket(WS_URL)

    socket.addEventListener('open', () => {
      onOpen && onOpen()
    })

    socket.addEventListener('message', event => {
      const parsed = parseEvent(event.data)
      if (parsed && onEvent) onEvent(parsed)
    })

    socket.addEventListener('error', event => {
      onError && onError(event)
    })

    socket.addEventListener('close', event => {
      if (!closedByClient && !retried) {
        retried = true
        setTimeout(() => {
          if (!closedByClient) attachSocket()
        }, 1000)
      }

      onClose && onClose(event)
    })
  }

  attachSocket()

  return {
    close() {
      closedByClient = true
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close()
        return
      }
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        socket.close()
      }
    }
  }
}
