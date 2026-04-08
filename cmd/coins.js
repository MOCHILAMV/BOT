module.exports = {
  name: 'coins',
  aliases: [],
  kind: 'simple',
  help: ['coins'],

  async run(bot, log) {
    if (!bot) return

    const dono = String(process.env.DONO || '').trim()

    if (!dono) {
      log('DONO não definido no .env')
      return
    }

    if (bot._coinsRunning) {
      log('coins já está em execução')
      return
    }

    bot._coinsRunning = true

    let finished = false
    let timeout = null
    let queryTimer = null
    let payTimer1 = null
    let payTimer2 = null
    let seenMessages = new Set()
    let payValueLocked = null

    function stripAnsi(text) {
      return String(text || '').replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
    }

    function normalizeText(text) {
      return stripAnsi(text)
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
        .trim()
    }

    function cleanup() {
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }

      if (queryTimer) {
        clearTimeout(queryTimer)
        queryTimer = null
      }

      if (payTimer1) {
        clearTimeout(payTimer1)
        payTimer1 = null
      }

      if (payTimer2) {
        clearTimeout(payTimer2)
        payTimer2 = null
      }

      bot.removeListener('message', onMessage)
      bot._coinsRunning = false
    }

    function finish(text) {
      if (finished) return
      finished = true
      cleanup()
      log(text)
    }

    function now() {
      return Date.now()
    }

    function getLastChatAt() {
      return bot._coinsLastChatAt || 0
    }

    function setLastChatAt() {
      bot._coinsLastChatAt = now()
    }

    function chatCooldownMs() {
      return 2500
    }

    function waitForNextChatSlot() {
      const diff = now() - getLastChatAt()
      return Math.max(0, chatCooldownMs() - diff)
    }

    function sendChat(text) {
      try {
        bot.chat(text)
        setLastChatAt()
        return true
      } catch {
        return false
      }
    }

    function scheduleChat(text, delay, onFail) {
      return setTimeout(() => {
        if (finished) return

        const extraWait = waitForNextChatSlot()

        if (extraWait > 0) {
          const retry = scheduleChat(text, extraWait, onFail)

          if (text.startsWith('/pay ') && !payTimer1) {
            payTimer1 = retry
          }

          return
        }

        if (!sendChat(text) && typeof onFail === 'function') {
          onFail()
        }
      }, Math.max(0, delay))
    }

    function formatPayValue(integerPart, decimalPart) {
      const left = String(integerPart || '').replace(/\./g, '').trim()
      const right = String(decimalPart || '00').trim().slice(0, 2).padEnd(2, '0')

      if (!/^\d+$/.test(left)) return null
      if (!/^\d+$/.test(right)) return null

      return `${left}.${right}`
    }

    function extractBalance(text) {
      const normalized = normalizeText(text)
      const match = normalized.match(/Você possui:\s*([\d.]+)(?:,(\d+))?\s*Coins/i)

      if (!match || !match[1]) return null

      const payValue = formatPayValue(match[1], match[2] || '00')
      if (!payValue) return null

      const numeric = Number.parseFloat(payValue)
      if (!Number.isFinite(numeric)) return null

      return {
        payValue,
        numeric
      }
    }

    function isDuplicateMessage(text) {
      const key = normalizeText(text).toLowerCase()

      if (!key) return true
      if (seenMessages.has(key)) return true

      seenMessages.add(key)
      return false
    }

    function scheduleDoublePay(payValue) {
      const wait1 = waitForNextChatSlot() + 150
      const wait2 = wait1 + chatCooldownMs() + 300

      payTimer1 = setTimeout(() => {
        if (finished) return

        const extraWait = waitForNextChatSlot()
        if (extraWait > 0) {
          payTimer1 = scheduleChat(
            `/pay ${dono} ${payValue}`,
            extraWait + 100,
            () => finish('falha ao enviar o primeiro /pay')
          )
          return
        }

        if (!sendChat(`/pay ${dono} ${payValue}`)) {
          finish('falha ao enviar o primeiro /pay')
        }
      }, wait1)

      payTimer2 = setTimeout(() => {
        if (finished) return

        const extraWait = waitForNextChatSlot()
        if (extraWait > 0) {
          payTimer2 = scheduleChat(
            `/pay ${dono} ${payValue}`,
            extraWait + 100,
            () => finish('falha ao enviar o segundo /pay')
          )
          return
        }

        if (!sendChat(`/pay ${dono} ${payValue}`)) {
          finish('falha ao enviar o segundo /pay')
          return
        }

        finish(`/pay ${dono} ${payValue} x2`)
      }, wait2)
    }

    function onMessage(jsonMsg) {
      if (finished) return

      let text = ''

      try {
        text = jsonMsg.toString()
      } catch {
        try {
          text = jsonMsg.toAnsi()
        } catch {
          text = ''
        }
      }

      text = normalizeText(text)

      if (!text) return
      if (isDuplicateMessage(text)) return

      const balance = extractBalance(text)
      if (!balance) return

      if (balance.numeric <= 0) {
        finish('saldo é 0, nada para enviar')
        return
      }

      if (payValueLocked) return
      payValueLocked = balance.payValue

      scheduleDoublePay(payValueLocked)
    }

    bot.on('message', onMessage)

    timeout = setTimeout(() => {
      finish('não consegui ler o saldo')
    }, 12000)

    const wait = waitForNextChatSlot()

    queryTimer = setTimeout(() => {
      queryTimer = null

      if (!sendChat('/money')) {
        finish('falha ao consultar saldo')
      }
    }, wait)
  }
}
