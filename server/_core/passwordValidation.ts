/**
 * Password Validation Utilities for NERVIX
 * Strong password requirements to enhance security
 */

/**
 * Password complexity requirements
 */
export interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbiddenPatterns: string[];
}

/**
 * Default password requirements (can be customized via environment variables)
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || "12"),
  maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH || "128"),
  requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
  requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
  requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== "false",
  requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== "false",
  forbiddenPatterns: [
    "password", "123456", "qwerty", "admin", "letmein", "welcome",
    "nervix", "crawd", "agent", "123", "abc", "test",
  ],
};

/**
 * Validate password against requirements
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }

  // Check maximum length
  if (password.length > requirements.maxLength) {
    errors.push(`Password must be no more than ${requirements.maxLength} characters long`);
  }

  // Check for uppercase letters
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Check for lowercase letters
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Check for numbers
  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Check for special characters
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Check for forbidden patterns
  const lowerPassword = password.toLowerCase();
  for (const pattern of requirements.forbiddenPatterns) {
    if (lowerPassword.includes(pattern)) {
      errors.push(`Password contains a forbidden pattern: "${pattern}"`);
    }
  }

  // Check for common sequences
  if (hasCommonSequence(password)) {
    errors.push("Password contains a common sequence or pattern");
  }

  // Check for repeated characters
  if (hasRepeatedCharacters(password)) {
    errors.push("Password contains too many repeated characters");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if password contains common sequences
 */
function hasCommonSequence(password: string): boolean {
  const commonSequences = [
    "123456", "234567", "345678", "456789", "567890",
    "qwerty", "asdfgh", "zxcvbn", "1q2w3e",
    "abcde", "bcdef", "cdefg", "defgh",
  ];

  const lowerPassword = password.toLowerCase();
  for (const sequence of commonSequences) {
    if (lowerPassword.includes(sequence)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if password has too many repeated characters
 */
function hasRepeatedCharacters(password: string): boolean {
  // Check for 3 or more consecutive same characters
  const consecutivePattern = /(.)\1{2,}/;
  if (consecutivePattern.test(password)) {
    return true;
  }

  // Check for excessive repetition overall
  const charCount: Record<string, number> = {};
  for (const char of password) {
    charCount[char] = (charCount[char] || 0) + 1;
  }

  for (const char in charCount) {
    if (charCount[char] > password.length / 2) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate password strength score (0-100)
 */
export function calculatePasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;

  // Length contributes up to 25 points
  score += Math.min(25, password.length * 2);

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/\d/.test(password)) score += 10;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;

  // Bonus for length
  if (password.length >= 16) score += 10;
  if (password.length >= 20) score += 10;

  // Penalty for common patterns
  if (hasCommonSequence(password)) score -= 20;
  if (hasRepeatedCharacters(password)) score -= 20;

  // Clamp between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine label and color
  let label: string;
  let color: string;

  if (score < 20) {
    label = "Very Weak";
    color = "red";
  } else if (score < 40) {
    label = "Weak";
    color = "orange";
  } else if (score < 60) {
    label = "Fair";
    color = "yellow";
  } else if (score < 80) {
    label = "Strong";
    color = "blue";
  } else {
    label = "Very Strong";
    color = "green";
  }

  return { score, label, color };
}

/**
 * Generate a secure random password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  const allChars = uppercase + lowercase + numbers + special;
  let password = "";

  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}
