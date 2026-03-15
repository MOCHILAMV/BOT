module.exports = {
  name: 'pos',
  aliases: [],
  kind: 'pos',
  help: ['pos', 'pos tp'],

  async run(bot, log, context, handleInput, api) {
    if (!bot || !bot.entity || !bot.entity.position) {
      log('Posição indisponível')
      return
    }

    const parts = api.safeArray(context)
    const sub = parts[1] ? api.normalize(parts[1]) : ''

    const pos = bot.entity.position
    const yaw = bot.entity.yaw
    const pitch = bot.entity.pitch

    if (sub === 'tp') {
      log(`Posição: /tp ${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}`)
      return
    }

    log(
      `Posição:\n${Math.floor(pos.x)} ${Math.floor(pos.y)} ${Math.floor(pos.z)}\nYaw: ${yaw.toFixed(2)}\nPitch: ${pitch.toFixed(2)}`
    )
  }
}
