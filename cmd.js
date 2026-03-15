const path = require('path')
const readline = require('readline')
const fs = require('fs')

const { MacroEngine } = require('./bot-core')

const registry = require('./cmd-sys/registry')
const { makeAPI } = require('./cmd-sys/api')
const { createParser } = require('./cmd-sys/parser')
const { createExecutor } = require('./cmd-sys/executor')

const DATA_DIR = path.join(__dirname, 'data')

try {
  fs.mkdirSync(DATA_DIR, { recursive: true })
} catch {}

const MACRO_DB_PATH = path.join(__dirname, 'data', 'macros.db')
const engine = new MacroEngine(MACRO_DB_PATH)

registry.loadCommands(path.join(__dirname, 'cmd'))

const api = makeAPI({ registry, engine })
const parser = createParser(api)
const executor = createExecutor(api)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

let bot = null

function log(msg) {
  if (rl.closed) return
  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(`${msg}\n`)
  rl.prompt(true)
}

function attachBot(instance) {
  bot = instance
  rl.prompt()
}

function serverLog(msg) {
  try {
    log(msg)
  } catch {
    console.log(msg)
  }
}

function getRegisteredCommands() {
  return registry.list()
}

function resolveCommand(name) {
  return registry.resolve(name)
}

function reloadCommands() {
  return registry.loadCommands(path.join(__dirname, 'cmd'))
}

async function handleInput(line) {
  if (!bot) {
    log('Bot não conectado')
    return
  }

  const input = String(line || '').trim()

  if (!input) return

  if (input === 'q') {
    process.exit(0)
  }

  if (input === 'c') {
    attachBot(bot)
    return
  }

  const blocks = parser.parseInputToBlocks(input)

  await executor.executeBlocks(bot, log, blocks, handleInput)
}

rl.on('line', handleInput)
rl.on('close', () => process.exit(0))

module.exports = {
  attachBot,
  handleInput,
  rl,
  serverLog,
  log,
  engine,
  api,
  parser,
  executor,
  registry,
  commands: registry.commands,
  aliases: registry.aliases,
  getRegisteredCommands,
  resolveCommand,
  reloadCommands
}
