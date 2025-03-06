import { PostgrestError } from "@supabase/supabase-js";
import Logger from "./logger";

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: Error | PostgrestError
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: PostgrestError) {
    super(message, "DATABASE_ERROR", originalError);
    this.name = "DatabaseError";
  }
}

export class AuthError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(message, "AUTH_ERROR", originalError);
    this.name = "AuthError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class InsufficientCreditsError extends AppError {
  constructor() {
    super("Insufficient credits to perform this action", "INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
  }
}

export function handleError(error: unknown): AppError {
  Logger.error("An error occurred", error as Error);

  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, undefined, error);
  }

  return new AppError("An unexpected error occurred");
}

export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case "DATABASE_ERROR":
      return "Unable to access the database. Please try again later.";
    case "AUTH_ERROR":
      return "Authentication failed. Please sign in again.";
    case "VALIDATION_ERROR":
      return error.message;
    case "INSUFFICIENT_CREDITS":
      return "You don't have enough credits to perform this action.";
    default:
      return "Something went wrong. Please try again later.";
  }
} 