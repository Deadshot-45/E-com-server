import bcrypt from "bcrypt";

const saltRounds = 10;

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

/**
 * Validate a password against complexity requirements (length, patterns)
 * @param {string} password - The password to validate
 * @returns {ValidationResult} - { isValid: boolean, message: string }
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, message: "Password is required." };
  }
  if (password.length < 8) {
    return { isValid: false, message: "Password must be at least 8 characters long." };
  }
  
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasAtSymbol = /@/.test(password);
  
  if (!hasLower || !hasUpper || !hasNumber || !hasAtSymbol) {
    return { 
      isValid: false, 
      message: "Password must contain at least one uppercase letter, one lowercase letter, one number, and the '@' symbol." 
    };
  }
  
  return { isValid: true, message: "Password is valid." };
};

/**
 * Hash a plain text password
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} - The hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  } catch (error) {
    throw new Error("Error hashing password");
  }
};

/**
 * Compare a plain text password with a hashed password
 * @param {string} plainPassword - The plain text password
 * @param {string} hashedPassword - The hashed password stored in DB
 * @returns {Promise<boolean>} - True if passwords match, false otherwise
 */
export const comparePassword = async (plainPassword: string, hashedPassword: string): Promise<boolean> => {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error("Error comparing passwords");
  }
};
