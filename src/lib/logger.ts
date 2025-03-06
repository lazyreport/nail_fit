import { PostgrestError } from "@supabase/supabase-js";

type LogLevel = "info" | "warn" | "error" | "debug";

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