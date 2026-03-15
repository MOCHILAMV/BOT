module.exports = {
  name: 'st',
  aliases: [],
  kind: 'simple',
  help: ['st'],

  async run(bot, log) {
    try {
      if (!bot || typeof bot.food !== 'number' || typeof bot.health !== 'number') {
        log('status indisponível')
        return
      }

      const hunger = Number(bot.food)
      const health = Number(bot.health)
      const oxygen = Number(bot.oxygenLevel ?? 0)

      log(`hp: ${health} | fome: ${hunger} | oxigênio: ${oxygen}`)
    } catch (e) {
      log(`st erro: ${e.message || String(e)}`)
    }
  }
}
