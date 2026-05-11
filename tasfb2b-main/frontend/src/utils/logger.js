import { logApi } from '../api/simulationApi'

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

const CURRENT_LEVEL = import.meta.env.PROD ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG

class Logger {
  constructor(context = 'FRONTEND') {
    this.context = context
  }

  async _log(level, message, ...args) {
    if (LOG_LEVELS[level] < CURRENT_LEVEL) return

    const formattedMessage = args.length > 0 
      ? `${message} ${args.map(a => JSON.stringify(a)).join(' ')}` 
      : message

    // Always log to console
    const consoleMethod = level.toLowerCase() === 'debug' ? 'log' : level.toLowerCase()
    console[consoleMethod](`[${this.context}] ${message}`, ...args)

    // Send to backend
    try {
      await logApi.send({
        level,
        message: formattedMessage,
        context: this.context
      })
    } catch (e) {
      // If logging fails, just log to console to avoid infinite loops
      console.warn('Failed to send log to backend:', e.message)
    }
  }

  debug(msg, ...args) { this._log('DEBUG', msg, ...args) }
  info(msg, ...args) { this._log('INFO', msg, ...args) }
  warn(msg, ...args) { this._log('WARN', msg, ...args) }
  error(msg, ...args) { this._log('ERROR', msg, ...args) }
}

export const logger = new Logger()
export const createLogger = (context) => new Logger(context)
