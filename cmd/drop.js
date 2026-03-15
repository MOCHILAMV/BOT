module.exports = {
  name: 'drop',
  aliases: [],
  kind: 'simple',
  help: ['drop'],

  async run(bot, log) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

    const dropItem = async item => {
      try {
        await bot.tossStack(item)
        return
      } catch {}

      try {
        await bot.toss(item.type, null, item.count)
      } catch {}
    }

    const unequipArmor = async () => {
      const slots = [
        [5, 'head'],
        [6, 'torso'],
        [7, 'legs'],
        [8, 'feet']
      ]

      for (const [slot, destination] of slots) {
        if (!bot.inventory.slots[slot]) continue

        try {
          await bot.equip(null, destination)
        } catch {}

        await sleep(150)
      }
    }

    try {
      let loop = 0

      while (true) {
        const items = bot.inventory.items()
        const hasEquippedArmor =
          Boolean(bot.inventory.slots[5]) ||
          Boolean(bot.inventory.slots[6]) ||
          Boolean(bot.inventory.slots[7]) ||
          Boolean(bot.inventory.slots[8])

        if (items.length === 0 && !hasEquippedArmor) break

        for (const item of items) {
          await dropItem(item)
          await sleep(200)
        }

        await unequipArmor()

        loop += 1
        if (loop > 120) break

        await sleep(300)
      }

      log('drop completo')
    } catch (e) {
      log(`drop erro: ${e.message || String(e)}`)
    }
  }
}
