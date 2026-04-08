require('dotenv').config()

const mineflayer = require('mineflayer')
const cmd = require('./cmd')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const EMAIL = process.env.EMAIL
const NAME = process.env.NAME

const OPT = {
  host: process.env.IP,
  port: Number.parseInt(process.env.PORT, 10),
  version: process.env.VERSION,
  checkTimeoutInterval: 100000,
  viewDistance: 0,
  username: EMAIL || NAME
}

if (EMAIL) {
  OPT.auth = 'microsoft'
}

let bot = null
let reconnectTimer = null
let watchdogInterval = null

function relay(text, error = false) {
  if (error) {
    console.error(text)
  } else {
    console.log(text)
  }

  try {
    cmd.serverLog(text)
  } catch {}
}

function clearWatchdog() {
  if (!watchdogInterval) return
  clearInterval(watchdogInterval)
  watchdogInterval = null
}

function clearReconnect() {
  if (!reconnectTimer) return
  clearTimeout(reconnectTimer)
  reconnectTimer = null
}

function destroyBot() {
  const instance = bot
  bot = null

  if (!instance) return

  try {
    instance.quit()
  } catch {}
}

function safeRestart(delay = 5000) {
  if (reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    startBot()
  }, delay)

  clearWatchdog()
  destroyBot()
}

function setupWatchdog() {
  clearWatchdog()

  let last = Date.now()

  watchdogInterval = setInterval(() => {
    const now = Date.now()

    if (now - last > 3000) {
      safeRestart(2000)
      return
    }

    last = now
  }, 1000)
}

function setupMessageLogger(instance) {
  instance.on('message', jsonMsg => {
    try {
      const msg = jsonMsg.toAnsi()
      if (msg && msg.trim()) cmd.serverLog(msg)
    } catch {}
  })
}

function setupErrorHandlers(instance) {
  instance.on('error', e => {
    const txt = `Erro: ${e && e.message ? e.message : String(e)}`
    relay(txt, true)
  })

  instance.on('end', reason => {
    const txt = `Fim: ${reason}`
    relay(txt)

    if (instance !== bot) return
    safeRestart()
  })
}

async function handleSpawn(instance) {
  await sleep(500)

  if (instance !== bot) return

  cmd.attachBot(instance)
  setupMessageLogger(instance)
  cmd.serverLog('BOT PRONTO.')
  setupWatchdog()
}

function startBot() {
  if (bot) return

  const instance = mineflayer.createBot(OPT)
  bot = instance

  setupErrorHandlers(instance)

  instance.once('spawn', async () => {
    try {
      await handleSpawn(instance)
    } catch (e) {
      const txt = `Erro no spawn: ${e && e.message ? e.message : String(e)}`
      relay(txt, true)

      if (instance !== bot) return
      safeRestart(2000)
    }
  })
}

function shutdown() {
  clearWatchdog()
  clearReconnect()
  destroyBot()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

startBot()
