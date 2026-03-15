function getState(bot) {
  if (!bot._lookState) {
    bot._lookState = {
      active: false,
      timer: null,
      radius: 64,
      busy: false
    }
  }
  return bot._lookState
}

function stopLook(bot) {
  const state = getState(bot)
  state.active = false
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
  state.busy = false
}

function findNearestPlayer(bot, radius) {
  const me = bot.entity?.position
  if (!me) return null

  let best = null
  let bestDistSq = radius * radius

  for (const id in bot.entities) {
    const entity = bot.entities[id]
    if (entity?.type !== 'player' || entity.username === bot.username || !entity.position) continue

    const dx = entity.position.x - me.x
    const dy = entity.position.y - me.y
    const dz = entity.position.z - me.z
    const distSq = dx * dx + dy * dy + dz * dz

    if (distSq <= bestDistSq) {
      best = entity
      bestDistSq = distSq
    }
  }

  return best
}

async function lookAtNearest(bot) {
  const state = getState(bot)
  if (!state.active || state.busy || !bot.entity?.position) return

  const target = findNearestPlayer(bot, state.radius)
  if (!target) return

  state.busy = true

  const from = bot.entity.position
  const dx = target.position.x - from.x
  const dy = target.position.y - from.y
  const dz = target.position.z - from.z

  const yaw = Math.atan2(-dx, -dz)
  const pitch = Math.atan2(dy, Math.sqrt(dx * dx + dz * dz))

  try {
    await bot.look(yaw, pitch, true)
  } catch {}

  state.busy = false
}

function startLook(bot) {
  stopLook(bot)
  const state = getState(bot)
  state.active = true
  state.timer = setInterval(() => lookAtNearest(bot), 25)
}

module.exports = {
  name: 'look',
  aliases: [],
  kind: 'simple',
  help: ['look', 'look <raio>'],

  async run(bot, log, context, handleInput, api) {
    if (!bot?.entity) return

    const state = getState(bot)
    const parts = api.safeArray(context)

    if (state.active) {
      stopLook(bot)
      log('look off')
      return
    }

    const rawRadius = Number(parts[1])
    if (rawRadius > 0) state.radius = rawRadius

    startLook(bot)
    log(`look on (${state.radius})`)
  }
}
