require('dotenv').config()

const mineflayer = require('mineflayer')
const cmd = require('./cmd')

const sleep = ms => new Promise(r => setTimeout(r, ms))

const OPT = {
  host: process.env.IP,
  port: Number.parseInt(process.env.PORT, 10),
  version: process.env.VERSION,
  checkTimeoutInterval: 100000,
  viewDistance: 0
}

const EMAIL = process.env.EMAIL
const NAME = process.env.NAME
const PASS = process.env.PASS

OPT.username = EMAIL || NAME
if (EMAIL) OPT.auth = 'microsoft'

const state = {
  bot: null,
  seq: 0,
  activeSeq: 0,
  shuttingDown: false,
  failures: 0
}

let reconnectTimer = null

function toText(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v !== 'object') return String(v)

  try {
    return (
      v.toAnsi?.() ||
      v.text ||
      v.reason ||
      v.message ||
      (Array.isArray(v.extra) ? v.extra.map(toText).join(' ') : v.extra) ||
      JSON.stringify(v)
    )
  } catch {
    return String(v)
  }
}

const isCurrentBot = (b, s) =>
  !state.shuttingDown && state.bot === b && state.activeSeq === s

function detachBot() {
  try { cmd.attachBot(null) } catch {}
}

function destroyBot() {
  const b = state.bot
  state.bot = null
  detachBot()
  if (!b) return
  try { b.quit() } catch {}
}

function clearReconnectTimer() {
  if (!reconnectTimer) return
  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function delayForFailure(n) {
  return [0, 10000, 60000, 300000, 600000][n] ?? null
}

function scheduleReconnect(reason) {
  if (state.shuttingDown || reconnectTimer) return

  state.failures++

  if (state.failures > 4) {
    const msg = `Falhou 5 vezes. Encerrando: ${reason || 'sem motivo'}`
    console.error(msg)
    try { cmd.serverLog(msg) } catch {}
    return shutdown(1)
  }

  const delay = delayForFailure(state.failures)

  try {
    cmd.serverLog(`Reconectando em ${Math.ceil(delay / 1000)}s. Tentativa ${state.failures}/5.`)
  } catch {}

  destroyBot()

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    startBot()
  }, delay)
}

function setupMessageHandler(bot, seq) {
  bot.on('message', msg => {
    if (!isCurrentBot(bot, seq)) return
    const text = msg?.toAnsi?.()
    if (text?.trim()) cmd.serverLog(text)
  })
}

function setupLifecycleHandlers(bot, seq) {
  bot.once('spawn', async () => {
    if (!isCurrentBot(bot, seq)) return

    state.failures = 0
    clearReconnectTimer()
    cmd.attachBot(bot)

    await sleep(500)

    if (!isCurrentBot(bot, seq)) return

    if (!EMAIL && PASS) {
      await sleep(150)
      if (!isCurrentBot(bot, seq)) return
      try { bot.chat(`/login ${PASS}`) } catch {}
    }

    cmd.serverLog('BOT PRONTO.')
  })

  const handleEnd = (type, data) => {
    if (!isCurrentBot(bot, seq)) return
    const text = toText(data) || 'sem motivo'
    cmd.serverLog(`${type}: ${text}`)
    scheduleReconnect(text)
  }

  bot.on('kicked', r => handleEnd('Kick', r))
  bot.on('error', e => handleEnd('Erro', e?.message || e))
  bot.on('end', r => handleEnd('Fim', r))
}

function startBot() {
  if (state.shuttingDown || state.bot) return

  clearReconnectTimer()

  const seq = ++state.seq
  state.activeSeq = seq

  let bot
  try {
    bot = mineflayer.createBot(OPT)
  } catch (e) {
    return scheduleReconnect(e?.message || String(e))
  }

  state.bot = bot

  setupMessageHandler(bot, seq)
  setupLifecycleHandlers(bot, seq)
}

function shutdown(code = 0) {
  state.shuttingDown = true
  clearReconnectTimer()
  destroyBot()
  process.exit(code)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

startBot()
