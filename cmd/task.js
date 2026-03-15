const { TaskManager } = require('../bot-core')
const path = require('path')
const fs = require('fs')

const DATA_DIR = path.join(__dirname, '..', 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const manager = new TaskManager(path.join(__dirname, '..', 'data', 'tasks.db'))
const timers = new Map()

let activeBot = null
let hydrated = false
let schedulerEnabled = true

function clearTimers() {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}

function removeTimer(id) {
  const timer = timers.get(id)
  if (!timer) return
  clearTimeout(timer)
  timers.delete(id)
}

function toInt(value) {
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function formatMode(mode) {
  return mode === 'loop' ? 'loop' : 'once'
}

function formatState(enabled) {
  return enabled ? 'ON' : 'OFF'
}

function formatInterval(intervalMs) {
  return `${Math.max(0, Math.floor(Number(intervalMs || 0) / 1000))}s`
}

function formatRemaining(nextRunMs) {
  return `${Math.max(0, Math.floor((Number(nextRunMs || 0) - Date.now()) / 1000))}s`
}

function isBotUsable(bot) {
  return Boolean(bot && bot.entity)
}

async function runTaskPayload(bot, payload, handleInput) {
  const text = String(payload || '').trim()
  if (!text) return
  if (!isBotUsable(bot)) return

  if (text.startsWith('/')) {
    bot.chat(text)
    return
  }

  await handleInput(text)
}

function scheduleTask(bot, task, handleInput) {
  if (!task || typeof task.id === 'undefined') return

  removeTimer(task.id)

  if (!schedulerEnabled) return
  if (!task.enabled) return
  if (!isBotUsable(bot)) return

  const delay = Math.max(0, Number(task.nextRunMs) - Date.now())
  const taskId = task.id

  const timer = setTimeout(async () => {
    timers.delete(taskId)

    if (!schedulerEnabled) return
    if (activeBot !== bot) return
    if (!isBotUsable(bot)) return

    try {
      await runTaskPayload(bot, task.command, handleInput)
    } catch {
    } finally {
      try {
        if (task.mode === 'loop') {
          const updated = manager.advanceTask(taskId)

          if (
            updated &&
            updated.enabled &&
            schedulerEnabled &&
            activeBot === bot &&
            isBotUsable(bot)
          ) {
            scheduleTask(bot, updated, handleInput)
          } else {
            removeTimer(taskId)
          }
        } else {
          manager.removeTask(taskId)
          removeTimer(taskId)
        }
      } catch {
        removeTimer(taskId)
      }
    }
  }, delay)

  timers.set(taskId, timer)
}

function scheduleAll(bot, handleInput) {
  clearTimers()

  if (!schedulerEnabled) return
  if (!isBotUsable(bot)) return

  const tasks = manager.listTasks()
  if (!Array.isArray(tasks)) return

  for (const task of tasks) {
    if (!task || typeof task.id === 'undefined') continue
    scheduleTask(bot, task, handleInput)
  }
}

function hydrate(bot, handleInput) {
  if (!bot) return

  if (activeBot !== bot) {
    activeBot = bot
    hydrated = false
    clearTimers()
  }

  schedulerEnabled = Boolean(manager.isSchedulerEnabled())

  if (hydrated) return

  scheduleAll(bot, handleInput)
  hydrated = true
}

module.exports = {
  name: 'task',
  aliases: [],
  kind: 'task',
  help: [
    'task <segundos> <comando>',
    'task loop <segundos> <comando>',
    'task list',
    'task clear',
    'task clear <id>',
    'task on <id>',
    'task off <id>',
    'task toggle'
  ],

  async run(bot, log, context, handleInput, api) {
    const parts = api.safeArray(context)

    if (!Array.isArray(parts) || parts.length === 0) {
      return
    }

    hydrate(bot, handleInput)

    const sub = parts[1] ? api.normalize(parts[1]) : ''

    if (sub === 'list') {
      const tasks = manager.listTasks()

      if (!Array.isArray(tasks) || tasks.length === 0) {
        log('SEM TASKS')
        return
      }

      for (const task of tasks) {
        log(
          `${task.id} | ${formatMode(task.mode)} | ${formatInterval(task.intervalMs)} | ${formatState(task.enabled)} | ${formatRemaining(task.nextRunMs)} | ${task.command}`
        )
      }

      return
    }

    if (sub === 'toggle') {
      schedulerEnabled = Boolean(manager.toggleScheduler())

      if (!schedulerEnabled) {
        clearTimers()
        log('TASKS CONGELADAS')
        return
      }

      scheduleAll(bot, handleInput)
      log('TASKS RETOMADAS')
      return
    }

    if (sub === 'clear') {
      const rawId = parts[2]

      if (!rawId) {
        manager.clearTasks()
        clearTimers()
        log('TASKS LIMPAS')
        return
      }

      const id = toInt(rawId)

      if (!id || id <= 0) {
        log('TASK NÃO ENCONTRADA')
        return
      }

      const removed = Boolean(manager.removeTask(id))
      removeTimer(id)

      if (!removed) {
        log('TASK NÃO ENCONTRADA')
        return
      }

      log(`TASK ${id} REMOVIDA`)
      return
    }

    if (sub === 'on' || sub === 'off') {
      const id = toInt(parts[2])

      if (!id || id <= 0) {
        log('TASK NÃO ENCONTRADA')
        return
      }

      const enabled = sub === 'on'
      const updated = manager.setTaskEnabled(id, enabled)

      if (!updated) {
        log('TASK NÃO ENCONTRADA')
        return
      }

      removeTimer(id)

      if (schedulerEnabled && updated.enabled) {
        scheduleTask(bot, updated, handleInput)
      }

      log(`TASK ${id} ${enabled ? 'LIGADA' : 'DESLIGADA'}`)
      return
    }

    let mode = 'once'
    let seconds = null
    let command = ''

    if (sub === 'loop') {
      mode = 'loop'
      seconds = Number(parts[2])
      command = parts.slice(3).join(' ').trim()
    } else if (sub === 'add') {
      mode = 'once'
      seconds = Number(parts[2])
      command = parts.slice(3).join(' ').trim()
    } else {
      seconds = Number(parts[1])
      command = parts.slice(2).join(' ').trim()
    }

    if (!Number.isFinite(seconds) || seconds <= 0 || !command) {
      log('USO: task <segundos> <comando>')
      return
    }

    const intervalMs = Math.floor(seconds * 1000)

    const task = mode === 'loop'
      ? manager.createLoopTask(command, intervalMs)
      : manager.createOnceTask(command, intervalMs)

    if (!task || typeof task.id === 'undefined') {
      log('ERRO AO CRIAR TASK')
      return
    }

    if (schedulerEnabled && task.enabled) {
      scheduleTask(bot, task, handleInput)
    }

    log(`TASK ${task.id} AGENDADA`)
  }
}
