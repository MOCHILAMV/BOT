const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

function normalize(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(':')[0]
}

function isSlash(token) {
  return typeof token === 'string' && token.startsWith('/')
}

function isNumber(value) {
  const n = Number(value)
  return Number.isFinite(n)
}

function safeArray(input) {
  if (Array.isArray(input)) return input
  return String(input || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function makeAPI({ registry, engine }) {
  function hasCommand(token) {
    return Boolean(registry.resolve(token))
  }

  function getCommand(token) {
    return registry.resolve(token)
  }

  function hasMacro(token) {
    try {
      return Boolean(engine.resolve(normalize(token)))
    } catch {
      return false
    }
  }

  function resolveMacro(token) {
    try {
      return engine.resolve(normalize(token))
    } catch {
      return null
    }
  }

  function isStarter(token) {
    if (!token) return false
    if (isSlash(token)) return true
    if (hasCommand(token)) return true
    if (hasMacro(token)) return true
    return false
  }

  return {
    normalize,
    sleep,
    isSlash,
    isNumber,
    safeArray,
    hasCommand,
    getCommand,
    hasMacro,
    resolveMacro,
    isStarter,
    registry,
    engine
  }
}

module.exports = {
  makeAPI,
  normalize,
  sleep,
  isSlash,
  isNumber,
  safeArray
}
