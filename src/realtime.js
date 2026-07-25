import { API_BASE_URL } from './api'

const listeners = new Set()
let socket = null
let reconnectTimer = null
let heartbeatTimer = null
let reconnectAttempt = 0
let stopped = true

function websocketUrl() {
  const configured = import.meta.env.VITE_WS_BASE_URL?.trim().replace(/\/+$/, '')
  if (configured) {
    const url = configured.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    return `${url}/ws/live/`
  }

  const apiUrl = new URL(API_BASE_URL, window.location.origin)
  apiUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  apiUrl.pathname = '/ws/live/'
  apiUrl.search = ''
  return apiUrl.toString()
}

function emit(event) {
  for (const listener of listeners) listener(event)
}

function scheduleReconnect() {
  if (stopped || reconnectTimer || !localStorage.getItem('khan_access')) return
  const delay = Math.min(15000, 1000 * (2 ** reconnectAttempt))
  reconnectAttempt += 1
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

function connect() {
  if (stopped || socket || !localStorage.getItem('khan_access')) return

  const current = new WebSocket(websocketUrl())
  socket = current

  current.addEventListener('open', () => {
    current.send(JSON.stringify({
      type: 'authenticate',
      token: localStorage.getItem('khan_access'),
    }))
  })
  current.addEventListener('message', ({ data }) => {
    let event
    try {
      event = JSON.parse(data)
    } catch {
      return
    }
    if (event.type === 'ready') {
      reconnectAttempt = 0
      clearInterval(heartbeatTimer)
      heartbeatTimer = window.setInterval(() => {
        if (current.readyState === WebSocket.OPEN) {
          current.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }
    emit(event)
  })
  current.addEventListener('close', () => {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
    if (socket === current) socket = null
    scheduleReconnect()
  })
  current.addEventListener('error', () => current.close())
}

export function startRealtime() {
  stopped = false
  connect()
}

export function stopRealtime() {
  stopped = true
  clearTimeout(reconnectTimer)
  clearInterval(heartbeatTimer)
  reconnectTimer = null
  heartbeatTimer = null
  reconnectAttempt = 0
  const current = socket
  socket = null
  if (current) current.close()
}

export function subscribeRealtime(resources, callback, includeReady = true) {
  const accepted = new Set(Array.isArray(resources) ? resources : [resources])
  let refreshTimer = null
  const listener = (event) => {
    if ((includeReady && event.type === 'ready')
      || (event.type === 'data.changed' && accepted.has(event.resource))) {
      clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => callback(event), 80)
    }
  }
  listeners.add(listener)
  return () => {
    clearTimeout(refreshTimer)
    listeners.delete(listener)
  }
}

export function subscribeRealtimeEvents(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function reconnectNow() {
  if (stopped || document.hidden || !navigator.onLine) return
  clearTimeout(reconnectTimer)
  reconnectTimer = null
  if (!socket) connect()
}

window.addEventListener('online', reconnectNow)
document.addEventListener('visibilitychange', reconnectNow)
