import bcrypt from "bcrypt";

export interface ValidationResult {
  isValid: boolean;
  message: string;
  score?: number;
  details?: string[];
}

export interface PasswordOptions {
  minLength?: number;
  requireUpper?: boolean;
  requireLower?: boolean;
  requireNumber?: boolean;
  requireSpecial?: boolean;
}

/** Simple, consistent error interface for Express responses */
export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: string[];
}

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Enhanced password validation (Option 2: Simple return values)
 */
export const validatePassword = (
  password: string,
  options: PasswordOptions = {},
): ValidationResult => {
  // Merge defaults with options (options override defaults)
  const {
    minLength = MIN_PASSWORD_LENGTH,
    requireUpper = true,
    requireLower = true,
    requireNumber = true,
    requireSpecial = true,
  } = options;

  // Early returns for common failures
  if (!password?.trim()) {
    return {
      isValid: false,
      message: "Password is required.",
      details: [],
    };
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < minLength) {
    return {
      isValid: false,
      message: `Password must be at least ${minLength} characters long.`,
      details: [
        `Minimum length: ${minLength}`,
        `Current length: ${trimmedPassword.length}`,
      ],
    };
  }

  // Define all regex patterns once
  const patterns = {
    lower: /[a-z]/,
    upper: /[A-Z]/,
    number: /\d/,
    special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/,
  } as const;

  // Collect failures
  const failures: string[] = [];

  if (requireLower && !patterns.lower.test(trimmedPassword)) {
    failures.push("lowercase letter");
  }
  if (requireUpper && !patterns.upper.test(trimmedPassword)) {
    failures.push("uppercase letter");
  }
  if (requireNumber && !patterns.number.test(trimmedPassword)) {
    failures.push("number");
  }
  if (requireSpecial && !patterns.special.test(trimmedPassword)) {
    failures.push("special character");
  }

  if (failures.length > 0) {
    return {
      isValid: false,
      message: `Missing required characters: ${failures.join(", ")}`,
      details: failures,
    };
  }

  // Calculate strength score (0-5)
  const lengthBonus = trimmedPassword.length > 12 ? 1 : 0;
  const score =
    lengthBonus +
    Number(patterns.lower.test(trimmedPassword)) +
    Number(patterns.upper.test(trimmedPassword)) +
    Number(patterns.number.test(trimmedPassword)) +
    Number(patterns.special.test(trimmedPassword));

  return {
    isValid: true,
    message: `Password strength: ${["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"][Math.floor(score)]}`,
    score: Math.min(score, 5),
  };
};

/**
 * Hash password (returns string or throws)
 */
export const hashPassword = async (
  password: string,
  rounds: number = SALT_ROUNDS,
): Promise<string> => {
  if (!password) throw new Error("Password is required");
  const salt = await bcrypt.genSalt(rounds);
  return await bcrypt.hash(password, salt);
};

/**
 * Compare passwords (returns boolean or throws)
 */
export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> => {
  if (!plainPassword || !hashedPassword)
    throw new Error("Password and hash required");
  return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Generate secure password (returns string)
 */
export const generateSecurePassword = (
  length: number = 12,
  options: PasswordOptions = {},
): string => {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let charset = chars;

  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const nums = "0123456789";
  const special = "!@#$%^&*()";

  if (!options.requireUpper)
    charset = charset.replaceAll(new RegExp(`[${upper}]`, "g"), "");
  if (!options.requireLower)
    charset = charset.replaceAll(new RegExp(`[${lower}]`, "g"), "");
  if (!options.requireNumber)
    charset = charset.replaceAll(new RegExp(`[${nums}]`, "g"), "");
  if (!options.requireSpecial)
    charset = charset.replaceAll(new RegExp(`[${special}]`, "g"), "");

  let password = "";
  const rand = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  for (let i = 0; i < length; i++) {
    password += charset.charAt(rand(0, charset.length - 1));
  }

  // Ensure requirements (basic guarantee)
  if (options.requireUpper && !/[A-Z]/.test(password))
    password = upper.charAt(rand(0, upper.length - 1)) + password.slice(1);

  return password;
};

/**
 * Express middleware factory for password validation errors
 */
export const handlePasswordValidation = (
  result: ValidationResult,
): ApiError | null => {
  if (result.isValid) return null;

  return {
    success: false,
    error: result.message,
    code: "PASSWORD_VALIDATION_FAILED",
    details: result.details,
  };
};

/**
 * Express middleware factory for password operation errors
 */
export const handlePasswordError = (error: unknown): ApiError => ({
  success: false,
  error: error instanceof Error ? error.message : "Password operation failed",
  code: "PASSWORD_OPERATION_ERROR",
});
