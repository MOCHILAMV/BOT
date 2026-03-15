module.exports = {
  name: 'armor',
  aliases: [],
  kind: 'simple',
  help: ['armor'],

  async run(bot, log) {
    const materialPriority = name => {
      if (!name) return 0
      if (name.includes('netherite')) return 7
      if (name.includes('diamond')) return 6
      if (name.includes('iron')) return 5
      if (name.includes('chainmail')) return 4
      if (name.includes('gold')) return 3
      if (name.includes('leather')) return 1
      return 2
    }

    const pickBest = items => {
      if (!Array.isArray(items) || items.length === 0) return null

      return items.reduce((best, item) => {
        if (!best) return item
        return materialPriority(item.name) > materialPriority(best.name) ? item : best
      }, null)
    }

    try {
      if (!bot || !bot.inventory || typeof bot.inventory.items !== 'function') {
        log('armor erro: bot indisponível')
        return
      }

      const items = bot.inventory.items()

      const heads = items.filter(item => item && item.name && (item.name.includes('helmet') || item.name.includes('cap')))
      const chests = items.filter(item => item && item.name && item.name.includes('chestplate'))
      const legs = items.filter(item => item && item.name && item.name.includes('leggings'))
      const boots = items.filter(item => item && item.name && item.name.includes('boots'))

      const bestHead = pickBest(heads)
      const bestChest = pickBest(chests)
      const bestLegs = pickBest(legs)
      const bestBoots = pickBest(boots)

      const results = []

      if (bestHead) {
        try {
          await bot.equip(bestHead, 'head')
          results.push(`head:${bestHead.name}`)
        } catch {}
      }

      if (bestChest) {
        try {
          await bot.equip(bestChest, 'torso')
          results.push(`chest:${bestChest.name}`)
        } catch {}
      }

      if (bestLegs) {
        try {
          await bot.equip(bestLegs, 'legs')
          results.push(`legs:${bestLegs.name}`)
        } catch {}
      }

      if (bestBoots) {
        try {
          await bot.equip(bestBoots, 'feet')
          results.push(`boots:${bestBoots.name}`)
        } catch {}
      }

      log(results.length > 0 ? `equipped: ${results.join(', ')}` : 'nenhuma armadura encontrada')
    } catch (e) {
      log(`armor erro: ${e.message || String(e)}`)
    }
  }
}
