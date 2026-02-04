/**
 * Validation Utilities
 * Provides input validation for authentication and form fields
 */

/**
 * Validates Egyptian National ID format (14 digits)
 */
export const isValidNationalId = (id: string): boolean => {
    if (!id) return false;
    // Egyptian national IDs are 14 digits
    const nationalIdPattern = /^\d{14}$/;
    return nationalIdPattern.test(id.trim());
};

/**
 * Validates Egyptian phone number format
 * Supports: 01xxxxxxxxx (11 digits starting with 0)
 */
export const isValidPhoneNumber = (phone: string): boolean => {
    if (!phone) return false;
    const phonePattern = /^01\d{9}$/;
    return phonePattern.test(phone.trim());
};

/**
 * Validates email address format
 */
export const isValidEmail = (email: string): boolean => {
    if (!email) return false;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email.trim());
};

/**
 * Validates username format
 * Alphanumeric with dots and underscores allowed, 3-50 characters
 */
export const isValidUsername = (username: string): boolean => {
    if (!username) return false;
    const usernamePattern = /^[a-zA-Z0-9._]{3,50}$/;
    return usernamePattern.test(username.trim());
};

/**
 * Validates employee code format (e.g., ENG-20550)
 */
export const isValidEmployeeCode = (code: string): boolean => {
    if (!code) return false;
    const codePattern = /^[A-Z]{2,3}-\d{4,6}$/;
    return codePattern.test(code.trim().toUpperCase());
};

/**
 * Determines the type of identifier provided
 */
export type IdentifierType = 'national_id' | 'phone' | 'email' | 'username' | 'employee_code' | 'unknown';

export const identifyInputType = (input: string): IdentifierType => {
    const trimmed = input.trim();
    
    if (isValidNationalId(trimmed)) return 'national_id';
    if (isValidPhoneNumber(trimmed)) return 'phone';
    if (isValidEmail(trimmed)) return 'email';
    if (isValidEmployeeCode(trimmed)) return 'employee_code';
    if (isValidUsername(trimmed)) return 'username';
    
    return 'unknown';
};

/**
 * Validates password strength
 * Requirements: min 6 characters
 */
export const isValidPassword = (password: string): boolean => {
    if (!password) return false;
    return password.length >= 6;
};

/**
 * Sanitizes and normalizes user input
 */
export const sanitizeInput = (input: string): string => {
    return input.trim().toLowerCase();
};

/**
 * Validates form field value based on type
 */
export const validateField = (
    value: string,
    fieldType: 'email' | 'phone' | 'username' | 'password' | 'national_id'
): { valid: boolean; message?: string } => {
    switch (fieldType) {
        case 'email':
            return {
                valid: isValidEmail(value),
                message: 'Invalid email format'
            };
        case 'phone':
            return {
                valid: isValidPhoneNumber(value),
                message: 'Phone must be 11 digits starting with 01'
            };
        case 'username':
            return {
                valid: isValidUsername(value),
                message: 'Username should be 3-50 characters (alphanumeric, dots, underscores)'
            };
        case 'password':
            return {
                valid: isValidPassword(value),
                message: 'Password must be at least 6 characters'
            };
        case 'national_id':
            return {
                valid: isValidNationalId(value),
                message: 'National ID must be 14 digits'
            };
        default:
            return { valid: false };
    }
};

/**
 * Validates field uniqueness check result
 */
export const isDuplicateError = (error: string): boolean => {
    return error.toLowerCase().includes('duplicate') || error.toLowerCase().includes('already exists');
};
