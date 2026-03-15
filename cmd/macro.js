module.exports = {
  name: 'macro',
  aliases: [],
  kind: 'macro',
  help: ['macro add <nome> <comando>', 'macro del <nome>', 'macro list'],

  async run(bot, log, context, handleInput, api) {
    const parts = api.safeArray(context)

    if (parts.length === 0) return

    const sub = parts[1] ? api.normalize(parts[1]) : ''
    const engine = api.engine

    if (sub === 'add') {
      const name = parts[2]
      const command = parts.slice(3).join(' ').trim()

      if (!name || !command) {
        log('USO: macro add <nome> <comando>')
        return
      }

      engine.add(api.normalize(name), command)
      log(`MACRO ADICIONADA: ${api.normalize(name)} => ${command}`)
      return
    }

    if (sub === 'del') {
      const name = parts[2]

      if (!name) {
        log('USO: macro del <nome>')
        return
      }

      engine.del(api.normalize(name))
      log(`MACRO REMOVIDA: ${api.normalize(name)}`)
      return
    }

    if (sub === 'list') {
      const list = engine.list()

      if (!Array.isArray(list) || list.length === 0) {
        log('SEM MACROS')
        return
      }

      for (const item of list) {
        if (Array.isArray(item) && item.length >= 2) {
          log(`${item[0]} => ${item[1]}`)
        }
      }

      return
    }

    log('USO: macro <add|del|list>')
  }
}
