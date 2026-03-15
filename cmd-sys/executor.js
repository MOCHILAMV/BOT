function createExecutor(api) {
  async function executeSlashBlock(bot, log, block) {
    bot.chat(block.tokens.join(' '))
  }

  async function executeMacroBlock(bot, log, block) {
    const resolved = api.resolveMacro(block.name)

    if (!resolved) {
      log(`Desconhecido: ${block.tokens[0]}`)
      return
    }

    const tail = block.tokens.slice(1).join(' ')
    const final = tail ? `${resolved} ${tail}` : resolved

    if (final.startsWith('/')) {
      bot.chat(final)
      return
    }

    await executeInput(bot, log, final)
  }

  async function executeCommandBlock(bot, log, block, handleInput) {
    const command = block.command || api.getCommand(block.name)

    if (!command || typeof command.run !== 'function') {
      log(`Desconhecido: ${block.tokens[0]}`)
      return
    }

    const context = command.name === 'help'
      ? api.registry.list()
      : block.tokens

    await command.run(bot, log, context, handleInput, api)
  }

  async function executeUnknownBlock(bot, log, block) {
    log(`Desconhecido: ${block.tokens[0]}`)
  }

  async function executeBlock(bot, log, block, handleInput) {
    if (!block) return

    if (block.type === 'slash') {
      await executeSlashBlock(bot, log, block)
      return
    }

    if (block.type === 'macro') {
      await executeMacroBlock(bot, log, block)
      return
    }

    if (block.type === 'command') {
      await executeCommandBlock(bot, log, block, handleInput)
      return
    }

    await executeUnknownBlock(bot, log, block)
  }

  async function executeBlocks(bot, log, blocks, handleInput) {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      try {
        await executeBlock(bot, log, block, handleInput)

        if (i < blocks.length - 1) {
          await api.sleep(2000)
        }
      } catch (e) {
        const label = block && block.tokens && block.tokens[0] ? block.tokens[0] : 'comando'
        log(`Erro em ${label}: ${e.message}`)
        break
      }
    }
  }

  async function executeInput(bot, log, input, handleInputOverride) {
    if (typeof handleInputOverride === 'function') {
      await handleInputOverride(input)
      return
    }

    throw new Error('handleInput não disponível')
  }

  return {
    executeSlashBlock,
    executeMacroBlock,
    executeCommandBlock,
    executeUnknownBlock,
    executeBlock,
    executeBlocks,
    executeInput
  }
}

module.exports = {
  createExecutor
}
