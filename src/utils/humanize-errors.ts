import { CryptoError } from "@/crypto";
import { ApiError } from "@/api/types";

export function humanizeInputError(type: string): string {
  switch (type) {
    case "EMPTY":
      return "Please enter a URL.";
    case "PARSE_FAILED":
      return "That doesn't look like a valid URL.";
    case "UNSUPPORTED_SCHEME":
      return "Only http:// and https:// URLs are supported.";
    default:
      return "Invalid URL.";
  }
}

export function humanizeCreateError(err: CryptoError | ApiError): string {
  if (err instanceof CryptoError) {
    if (err.type === "URL_TOO_LONG") {
      return "This URL is too long to shorten.";
    }
    if (err.type === "PASSWORD_EMPTY") {
      return "Password must not be empty.";
    }
    return "Encryption failed in your browser.";
  }
  switch (err.type) {
    case "RATE_LIMITED":
      return "You've created too many links recently. Try again in a few minutes.";
    case "BUDGET_EXHAUSTED":
      return "VoidHop has reached its daily link creation limit. Try again tomorrow.";
    case "ORIGIN_BUDGET_EXHAUSTED":
      return "This service has reached today's quota for your origin.";
    case "BLOB_TOO_LARGE":
      return "This URL is too long to shorten.";
    case "VALIDATION_ERROR":
      return "The server rejected the request. This usually means the URL is malformed.";
    case "NETWORK_ERROR":
      return "Could not reach VoidHop. Check your connection.";
    case "NOT_FOUND":
      return "VoidHop is misconfigured — the create endpoint is unreachable. If you're running locally, make sure both the frontend and the worker dev server are running, and check the worker console for errors.";
    default:
      return "Something went wrong on the server.";
  }
}
