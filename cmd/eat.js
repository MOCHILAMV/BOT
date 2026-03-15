module.exports = {
  name: 'eat',
  aliases: [],
  kind: 'simple',
  help: ['eat'],

  async run(bot, log) {
    if (!bot || !bot.inventory) {
      log('bot indisponível')
      return
    }

    const items = bot.inventory.items()

    if (!items || items.length === 0) {
      log('sem comida')
      return
    }

    const food = items.find(i => i && i.name && i.name.includes('bread') || i.name.includes('beef') || i.name.includes('pork') || i.name.includes('chicken') || i.name.includes('apple'))

    if (!food) {
      log('sem comida')
      return
    }

    try {
      await bot.equip(food, 'hand')
      await bot.consume()
      log('comendo...')
    } catch (e) {
      log(`eat erro: ${e.message || String(e)}`)
    }
  }
}
