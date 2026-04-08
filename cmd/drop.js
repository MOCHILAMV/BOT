const state = {
  loopEnabled: false,
  loopBusy: false,
  loopToken: 0
}

const DROP_DELAY = 120
const UNEQUIP_DELAY = 90
const LOOP_DELAY = 220
const EMPTY_LOOP_DELAY = 350

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isBotUsable(bot) {
  return Boolean(bot && bot.inventory && Array.isArray(bot.inventory.slots))
}

function getEquipmentDestinations() {
  return ['head', 'torso', 'legs', 'feet', 'off-hand']
}

function getEquipmentSlot(bot, destination) {
  if (typeof bot?.getEquipmentDestSlot === 'function') {
    try {
      return bot.getEquipmentDestSlot(destination)
    } catch {}
  }

  if (destination === 'head') return 5
  if (destination === 'torso') return 6
  if (destination === 'legs') return 7
  if (destination === 'feet') return 8
  if (destination === 'off-hand') return 45
  return -1
}

function getEquipmentSlotSet(bot) {
  const out = new Set()

  for (const destination of getEquipmentDestinations()) {
    const slot = getEquipmentSlot(bot, destination)
    if (slot >= 0) out.add(slot)
  }

  return out
}

function inventoryItems(bot) {
  if (!isBotUsable(bot)) return []

  const blocked = getEquipmentSlotSet(bot)

  try {
    return bot.inventory.items().filter(item => item && !blocked.has(item.slot))
  } catch {
    return []
  }
}

function itemKey(item) {
  if (!item) return ''
  return [
    item.type ?? '',
    item.metadata ?? '',
    item.count ?? '',
    item.name ?? '',
    item.slot ?? ''
  ].join('|')
}

function sameItem(a, b) {
  if (!a || !b) return false
  return a.type === b.type && a.metadata === b.metadata && a.name === b.name
}

function snapshotSlots(bot) {
  if (!isBotUsable(bot)) return []
  return bot.inventory.slots.map(itemKey)
}

function findMovedItem(bot, beforeSnapshot, original) {
  if (!isBotUsable(bot) || !original) return null

  const blocked = getEquipmentSlotSet(bot)
  const slots = bot.inventory.slots

  for (let i = 0; i < slots.length; i++) {
    if (blocked.has(i)) continue

    const now = slots[i]
    if (!now) continue
    if (!sameItem(now, original)) continue

    const before = beforeSnapshot[i] || ''
    const after = itemKey(now)

    if (before !== after) {
      return now
    }
  }

  const items = inventoryItems(bot)

  for (const item of items) {
    if (sameItem(item, original)) return item
  }

  return null
}

async function dropStack(bot, item) {
  if (!isBotUsable(bot) || !item) return false

  try {
    await bot.tossStack(item)
    return true
  } catch {}

  try {
    await bot.toss(item.type, item.metadata ?? null, item.count ?? null)
    return true
  } catch {}

  return false
}

async function dropAllInventory(bot) {
  if (!isBotUsable(bot)) return false

  let changed = false

  while (true) {
    const item = inventoryItems(bot)[0]
    if (!item) break

    const ok = await dropStack(bot, item)
    if (!ok) break

    changed = true
    await sleep(DROP_DELAY)
  }

  return changed
}

async function dropEquipped(bot, destination) {
  if (!isBotUsable(bot)) return false

  const slot = getEquipmentSlot(bot, destination)
  if (slot < 0) return false

  const equipped = bot.inventory.slots[slot]
  if (!equipped) return false

  const beforeSnapshot = snapshotSlots(bot)

  try {
    await bot.unequip(destination)
  } catch {
    return false
  }

  await sleep(UNEQUIP_DELAY)

  const moved = findMovedItem(bot, beforeSnapshot, equipped)
  if (!moved) return false

  const ok = await dropStack(bot, moved)
  if (!ok) return false

  await sleep(DROP_DELAY)
  return true
}

async function dropArmorAndShield(bot) {
  if (!isBotUsable(bot)) return false

  let changed = false

  for (const destination of getEquipmentDestinations()) {
    const ok = await dropEquipped(bot, destination)
    if (ok) changed = true
  }

  return changed
}

async function runDropLoop(bot, log, token) {
  if (state.loopBusy) return

  state.loopBusy = true

  try {
    while (state.loopEnabled && state.loopToken === token) {
      const changed = await dropAllInventory(bot)

      if (!state.loopEnabled || state.loopToken !== token) break

      await sleep(changed ? LOOP_DELAY : EMPTY_LOOP_DELAY)
    }
  } catch (e) {
    log(`drop loop erro: ${e.message || String(e)}`)
  } finally {
    if (state.loopToken === token) {
      state.loopBusy = false
    } else {
      state.loopBusy = false
    }
  }
}

module.exports = {
  name: 'drop',
  aliases: [],
  kind: 'linear',
  help: ['drop', 'drop loop', 'drop armor'],

  async run(bot, log, context, handleInput, api) {
    const parts = api.safeArray(context)
    const sub = parts[1] ? api.normalize(parts[1]) : ''

    if (sub === 'loop') {
      if (state.loopEnabled) {
        state.loopEnabled = false
        state.loopToken += 1
        log('drop loop desligado')
        return
      }

      state.loopEnabled = true
      state.loopToken += 1
      const token = state.loopToken

      log('drop loop ligado')
      runDropLoop(bot, log, token)
      return
    }

    if (state.loopBusy) {
      log('drop ocupado')
      return
    }

    if (sub === 'armor') {
      try {
        const changed = await dropArmorAndShield(bot)
        log(changed ? 'drop armor completo' : 'drop armor vazio')
      } catch (e) {
        log(`drop armor erro: ${e.message || String(e)}`)
      }
      return
    }

    try {
      const changed = await dropAllInventory(bot)
      log(changed ? 'drop completo' : 'drop vazio')
    } catch (e) {
      log(`drop erro: ${e.message || String(e)}`)
    }
  }
}
