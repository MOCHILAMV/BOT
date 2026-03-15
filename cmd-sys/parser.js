function parseSimpleBlock(parts, index, api) {
  const command = api.getCommand(parts[index])

  return {
    type: 'command',
    name: command.name,
    command,
    tokens: [parts[index]],
    next: index + 1
  }
}

function parseLinearBlock(parts, index, api) {
  const command = api.getCommand(parts[index])
  const tokens = [parts[index]]
  let next = index + 1

  while (next < parts.length && !api.isStarter(parts[next])) {
    tokens.push(parts[next])
    next += 1
  }

  return {
    type: 'command',
    name: command.name,
    command,
    tokens,
    next
  }
}

function parseSlashBlock(parts, index) {
  let next = index + 1

  while (next < parts.length && !String(parts[next]).startsWith('/')) {
    next += 1
  }

  return {
    type: 'slash',
    tokens: parts.slice(index, next),
    next
  }
}

function parseMacroInvocationBlock(parts, index, api) {
  let next = index + 1

  while (next < parts.length && !api.isStarter(parts[next])) {
    next += 1
  }

  return {
    type: 'macro',
    name: api.normalize(parts[index]),
    tokens: parts.slice(index, next),
    next
  }
}

function parsePosBlock(parts, index, api) {
  const command = api.getCommand(parts[index])
  const tokens = [parts[index]]
  let next = index + 1

  if (next < parts.length && !api.isStarter(parts[next])) {
    tokens.push(parts[next])
    next += 1
  }

  return {
    type: 'command',
    name: command.name,
    command,
    tokens,
    next
  }
}

function parseMacroCommandBlock(parts, index, api, parseBlock) {
  const command = api.getCommand(parts[index])
  const tokens = [parts[index]]
  const sub = api.normalize(parts[index + 1])

  if (!parts[index + 1]) {
    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 1
    }
  }

  tokens.push(parts[index + 1])

  if (sub === 'list') {
    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 2
    }
  }

  if (sub === 'del') {
    if (parts[index + 2]) {
      tokens.push(parts[index + 2])
      return {
        type: 'command',
        name: command.name,
        command,
        tokens,
        next: index + 3
      }
    }

    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 2
    }
  }

  if (sub === 'add') {
    if (parts[index + 2]) {
      tokens.push(parts[index + 2])
    } else {
      return {
        type: 'command',
        name: command.name,
        command,
        tokens,
        next: index + 2
      }
    }

    if (index + 3 < parts.length) {
      const payload = parseBlock(parts, index + 3)

      if (payload && Array.isArray(payload.tokens) && payload.tokens.length > 0) {
        tokens.push(...payload.tokens)
        return {
          type: 'command',
          name: command.name,
          command,
          tokens,
          next: payload.next
        }
      }
    }

    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 3
    }
  }

  return {
    type: 'command',
    name: command.name,
    command,
    tokens,
    next: index + 2
  }
}

function parseTaskCommandBlock(parts, index, api, parseBlock) {
  const command = api.getCommand(parts[index])
  const tokens = [parts[index]]
  const second = parts[index + 1]
  const secondNorm = api.normalize(second)

  if (!second) {
    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 1
    }
  }

  if (secondNorm === 'list' || secondNorm === 'toggle') {
    tokens.push(second)
    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 2
    }
  }

  if (secondNorm === 'clear' || secondNorm === 'on' || secondNorm === 'off') {
    tokens.push(second)

    if (parts[index + 2] && !api.isStarter(parts[index + 2])) {
      tokens.push(parts[index + 2])
      return {
        type: 'command',
        name: command.name,
        command,
        tokens,
        next: index + 3
      }
    }

    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 2
    }
  }

  if (secondNorm === 'loop') {
    tokens.push(second)

    if (parts[index + 2]) {
      tokens.push(parts[index + 2])
    } else {
      return {
        type: 'command',
        name: command.name,
        command,
        tokens,
        next: index + 2
      }
    }

    if (index + 3 < parts.length) {
      const payload = parseBlock(parts, index + 3)

      if (payload && Array.isArray(payload.tokens) && payload.tokens.length > 0) {
        tokens.push(...payload.tokens)
        return {
          type: 'command',
          name: command.name,
          command,
          tokens,
          next: payload.next
        }
      }
    }

    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 3
    }
  }

  if (secondNorm === 'add') {
    tokens.push(second)

    if (parts[index + 2]) {
      tokens.push(parts[index + 2])
    } else {
      return {
        type: 'command',
        name: command.name,
        command,
        tokens,
        next: index + 2
      }
    }

    if (index + 3 < parts.length) {
      const payload = parseBlock(parts, index + 3)

      if (payload && Array.isArray(payload.tokens) && payload.tokens.length > 0) {
        tokens.push(...payload.tokens)
        return {
          type: 'command',
          name: command.name,
          command,
          tokens,
          next: payload.next
        }
      }
    }

    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 3
    }
  }

  const seconds = Number(second)

  if (Number.isFinite(seconds) && seconds > 0) {
    tokens.push('add', second)

    if (index + 2 < parts.length) {
      const payload = parseBlock(parts, index + 2)

      if (payload && Array.isArray(payload.tokens) && payload.tokens.length > 0) {
        tokens.push(...payload.tokens)
        return {
          type: 'command',
          name: command.name,
          command,
          tokens,
          next: payload.next
        }
      }
    }

    return {
      type: 'command',
      name: command.name,
      command,
      tokens,
      next: index + 2
    }
  }

  return {
    type: 'command',
    name: command.name,
    command,
    tokens: [parts[index], second],
    next: index + 2
  }
}

function parseCommandBlock(parts, index, api, parseBlock) {
  const command = api.getCommand(parts[index])

  if (!command) {
    return {
      type: 'unknown',
      tokens: [parts[index]],
      next: index + 1
    }
  }

  if (typeof command.parse === 'function') {
    return command.parse(parts, index, api, parseBlock)
  }

  const kind = command.kind || 'simple'

  if (kind === 'simple') {
    return parseSimpleBlock(parts, index, api)
  }

  if (kind === 'linear') {
    return parseLinearBlock(parts, index, api)
  }

  if (kind === 'pos') {
    return parsePosBlock(parts, index, api)
  }

  if (kind === 'macro') {
    return parseMacroCommandBlock(parts, index, api, parseBlock)
  }

  if (kind === 'task') {
    return parseTaskCommandBlock(parts, index, api, parseBlock)
  }

  if (kind === 'greedy') {
    return parseLinearBlock(parts, index, api)
  }

  return parseSimpleBlock(parts, index, api)
}

function createParser(api) {
  function parseBlock(parts, index) {
    if (index >= parts.length) return null

    const token = parts[index]

    if (api.isSlash(token)) {
      return parseSlashBlock(parts, index)
    }

    if (api.hasCommand(token)) {
      return parseCommandBlock(parts, index, api, parseBlock)
    }

    if (api.hasMacro(token)) {
      return parseMacroInvocationBlock(parts, index, api)
    }

    return {
      type: 'unknown',
      tokens: [token],
      next: index + 1
    }
  }

  function parseInputToBlocks(input) {
    const parts = api.safeArray(input)
    const blocks = []

    let index = 0

    while (index < parts.length) {
      const block = parseBlock(parts, index)

      if (!block || !Array.isArray(block.tokens) || block.tokens.length === 0) {
        index += 1
        continue
      }

      blocks.push(block)

      if (typeof block.next !== 'number' || block.next <= index) {
        index += 1
      } else {
        index = block.next
      }
    }

    return blocks
  }

  return {
    parseBlock,
    parseInputToBlocks
  }
}

module.exports = {
  createParser
}
