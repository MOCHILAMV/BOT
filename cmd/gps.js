module.exports = {
  name: 'gps',
  aliases: [],
  kind: 'simple',
  help: ['gps'],

  async run(bot, log) {
    try {
      const radius = 50
      const me = bot?.entity?.position

      if (!me) {
        log('posição indisponível')
        return
      }

      const found = []

      for (const e of Object.values(bot.entities)) {
        if (!e || e.type !== 'player' || e.username === bot.username || !e.position) continue

        try {
          const dist = e.position.distanceTo(me)

          if (dist <= radius) {
            found.push({
              name: e.username || 'unknown',
              dist
            })
          }
        } catch {}
      }

      found.sort((a, b) => a.dist - b.dist)

      const text = found.length
        ? found.map(p => `${p.name}(${p.dist.toFixed(1)}m)`).join(', ')
        : 'nenhum'

      log(`Jogadores por perto: ${text}`)
    } catch (e) {
      log(`gps erro: ${e.message || String(e)}`)
    }
  }
}
