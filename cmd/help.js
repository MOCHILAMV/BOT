module.exports = {
  name: 'help',
  aliases: [],
  kind: 'simple',
  help: ['help'],

  async run(bot, log, context, handleInput, api) {
    const names = api.registry.list().sort((a, b) => a.localeCompare(b, 'pt-BR'))

    if (names.length === 0) {
      log('Nenhum comando disponível')
      return
    }

    log('Comandos disponíveis:')

    for (const name of names) {
      log(name)
    }

    log('Extras: q, c, /comando')
  }
}
