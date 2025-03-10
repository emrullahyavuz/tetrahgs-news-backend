const validator = require('validator');

// Validate email
const isValidEmail = (email) => {
  return validator.isEmail(email);
};

// Validate password
const isValidPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  return password.length >= 8 && 
         /[A-Z]/.test(password) && 
         /[a-z]/.test(password) && 
         /[0-9]/.test(password);
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return validator.escape(input);
  }
  return input;
};

// Validate URL
const isValidUrl = (url) => {
  return validator.isURL(url);
};

module.exports = {
  isValidEmail,
  isValidPassword,
  sanitizeInput,
  isValidUrl
};