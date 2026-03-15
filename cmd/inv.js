module.exports = {
  name: 'inv',
  aliases: [],
  kind: 'simple',
  help: ['inv'],

  async run(bot, log) {
    if (!bot || !bot.inventory || typeof bot.inventory.items !== 'function') {
      log('bot indisponível')
      return
    }

    const items = bot.inventory.items()

    if (!Array.isArray(items) || items.length === 0) {
      log('vazio')
      return
    }

    const text = items
      .filter(item => item && item.name)
      .map(item => `${item.name} x${item.count}`)
      .join(', ')

    log(text || 'vazio')
  }
}
