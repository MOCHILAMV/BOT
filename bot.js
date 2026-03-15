require('dotenv').config()

const mineflayer = require('mineflayer')
const cmd = require('./cmd')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const OPT = {
  host: process.env.IP,
  port: Number.parseInt(process.env.PORT, 10),
  version: process.env.VERSION,
  checkTimeoutInterval: 100000,
  viewDistance: 0
}

const EMAIL = process.env.EMAIL
const PASSWORD = process.env.PASSWORD
const NAME = process.env.NAME
const PASS = process.env.PASS

if (EMAIL) {
  OPT.username = EMAIL
  OPT.auth = 'microsoft'
} else {
  OPT.username = NAME
}

let bot = null
let reconnectTimer = null
let watchdogInterval = null

function clearWatchdog() {
  if (!watchdogInterval) return
  clearInterval(watchdogInterval)
  watchdogInterval = null
}

function destroyBot() {
  if (!bot) return

  try {
    bot.quit()
  } catch {}

  bot = null
}

function safeRestart(delay = 5000) {
  if (reconnectTimer) return

  clearWatchdog()
  destroyBot()

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    startBot()
  }, delay)
}

function setupWatchdog() {
  clearWatchdog()

  let last = Date.now()

  watchdogInterval = setInterval(() => {
    const now = Date.now()

    if (now - last - 1000 > 2000) {
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

      if (msg && msg.trim()) {
        cmd.serverLog(msg)
      }
    } catch {}
  })
}

function setupErrorHandlers(instance) {
  instance.on('error', e => {
    const txt = `Erro: ${e && e.message ? e.message : String(e)}`
    console.error(txt)

    try {
      cmd.serverLog(txt)
    } catch {}
  })

  instance.on('end', reason => {
    const txt = `Fim: ${reason}`
    console.log(txt)

    try {
      cmd.serverLog(txt)
    } catch {}

    safeRestart()
  })
}

async function reapplyPhysics(instance, delay = 250) {
  await sleep(delay)

  if (!bot || instance !== bot) return

  try {
    instance.physicsEnabled = true
  } catch {}

  try {
    instance.clearControlStates()
  } catch {}

  try {
    instance.setControlState('jump', false)
    instance.setControlState('forward', false)
    instance.setControlState('back', false)
    instance.setControlState('left', false)
    instance.setControlState('right', false)
    instance.setControlState('sprint', false)
  } catch {}
}

async function handleSpawn(instance) {
  await reapplyPhysics(instance, 250)
  await sleep(500)

  cmd.attachBot(instance)
  setupMessageLogger(instance)

  if (!EMAIL && PASS) {
    await sleep(100)

    try {
      instance.chat(`/login ${PASS}`)
    } catch {}
  }

  cmd.serverLog('BOT PRONTO.')
  setupWatchdog()
}

function startBot() {
  if (bot) return

  const instance = mineflayer.createBot(OPT)
  bot = instance

  instance.once('spawn', async () => {
    try {
      await handleSpawn(instance)
    } catch (e) {
      const txt = `Erro no spawn: ${e && e.message ? e.message : String(e)}`
      console.error(txt)

      try {
        cmd.serverLog(txt)
      } catch {}

      safeRestart(2000)
    }
  })

  instance.on('respawn', async () => {
    try {
      await reapplyPhysics(instance, 250)
    } catch {}
  })

  setupErrorHandlers(instance)
}

process.on('SIGINT', () => process.exit(0))

startBot()
