import { PostgrestError } from "@supabase/supabase-js";

// Define log levels
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

let currentLogLevel: LogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel) {
  currentLogLevel = level;
}

export function log(level: LogLevel, message: string, ...args: any[]) {
  if (shouldLog(level)) {
    console.log(`[${level}] ${message}`, ...args);
  }
}

function shouldLog(level: LogLevel): boolean {
  const levels = Object.values(LogLevel);
  return levels.indexOf(level) >= levels.indexOf(currentLogLevel);
}

export const logger = {
  debug: (message: string, ...args: any[]) => log(LogLevel.DEBUG, message, ...args),
  info: (message: string, ...args: any[]) => log(LogLevel.INFO, message, ...args),
  warn: (message: string, ...args: any[]) => log(LogLevel.WARN, message, ...args),
  error: (message: string, ...args: any[]) => log(LogLevel.ERROR, message, ...args),
  setLevel: setLogLevel
};

interface LogMessage {
  message: string;
  data?: any;
  error?: Error | PostgrestError | null;
  timestamp?: string;
}

const isDevelopment = import.meta.env.MODE === "development";

class Logger {
  private static formatMessage({ message, data, error, timestamp = new Date().toISOString() }: LogMessage) {
    return {
      message,
      ...(data && { data }),
      ...(error && { 
        error: {
          message: error.message,
          ...(error instanceof Error && { stack: error.stack }),
          ...(('code' in error) && { code: error.code })
        }
      }),
      timestamp
    };
  }

  static info(message: string, data?: any) {
    if (isDevelopment) {
      console.info("ℹ️", this.formatMessage({ message, data }));
    }
  }

  static warn(message: string, data?: any) {
    if (isDevelopment) {
      console.warn("⚠️", this.formatMessage({ message, data }));
    }
  }

  static error(message: string, error?: Error | PostgrestError | null, data?: any) {
    console.error("❌", this.formatMessage({ message, error, data }));
  }

  static credits(message: string, data?: any) {
    if (isDevelopment) {
      console.log("💳", this.formatMessage({ message, data }));
    }
  }

  static debug(message: string, data?: any) {
    if (isDevelopment) {
      console.debug("🔍", this.formatMessage({ message, data }));
    }
  }
}

export default Logger; 