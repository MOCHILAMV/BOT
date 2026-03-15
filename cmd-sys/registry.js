const fs = require('fs')
const path = require('path')

const commands = Object.create(null)
const aliases = Object.create(null)

function loadCommands(dir) {
  const files = fs.readdirSync(dir)

  for (const file of files) {
    if (!file.endsWith('.js')) continue

    const full = path.join(dir, file)
    const mod = require(full)

    if (!mod || typeof mod !== 'object') continue
    if (!mod.name || typeof mod.run !== 'function') continue

    const name = String(mod.name).toLowerCase()

    commands[name] = mod

    if (Array.isArray(mod.aliases)) {
      for (const a of mod.aliases) {
        aliases[String(a).toLowerCase()] = name
      }
    }
  }
}

function resolve(name) {
  const key = String(name || '').toLowerCase()

  if (commands[key]) return commands[key]

  const alias = aliases[key]

  if (alias && commands[alias]) {
    return commands[alias]
  }

  return null
}

function list() {
  return Object.keys(commands)
}

module.exports = {
  commands,
  aliases,
  loadCommands,
  resolve,
  list
}
