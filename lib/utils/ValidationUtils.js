const validateMobileNumber = (mobileNumber) => {
    if (!mobileNumber) {
        return { valid: false, message: "Mobile Number is required" };
    }
    
    if (mobileNumber.trim() === '') {
        return { valid: false, message: "Mobile Number cannot be empty" };
    }

    if (mobileNumber.length !== 10) {
        return { valid: false, message: "Mobile Number must be 10 digits long" };
    }

    const firstDigit = parseInt(mobileNumber.charAt(0), 10);
    if (![6, 7, 8, 9].includes(firstDigit)) {
        return { valid: false, message: "Mobile Number must start with 6, 7, 8, or 9" };
    }

    if (!/^\d+$/.test(mobileNumber)) {
        return { valid: false, message: "Mobile Number must contain only digits" };
    }

    return { valid: true };
};

const validateEmailAddress = (emailAddress) => {
    if (!emailAddress) {
        return { valid: false, message: "Email Address is required" };
    }
    
    if (emailAddress.trim() === '') {
        return { valid: false, message: "Email Address cannot be empty" };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
        return { valid: false, message: "Email Address is not valid" };
    }

    return { valid: true };
};

const validatePassword = (password) => {
    if (!password) {
        return { valid: false, message: "Password is required" };
    }
    
    if (password.trim() === '') {
        return { valid: false, message: "Password cannot be empty" };
    }

    if (password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long" };
    }

    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one uppercase letter" };
    }

    if (!/[a-z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one lowercase letter" };
    }

    if (!/\d/.test(password)) {
        return { valid: false, message: "Password must contain at least one digit" };
    }

    const specialCharacterRegex = /[!@#$%^&*]/;
    if (!specialCharacterRegex.test(password)) {
        return { valid: false, message: "Password must contain at least one special character" };
    }

    return { valid: true };
};

const validateCommonField = (fieldTitle, fieldValue) => {
    if (!fieldValue) {
        return { valid: false, message: fieldTitle + " is required" };
    }
    
    if (fieldValue.trim() === '') {
        return { valid: false, message: fieldTitle + " cannot be empty" };
    }
    return { valid: true };
};

const validateImageList = (fieldTitle, fieldValue) => {
    if (!fieldValue) {
        return { valid: false, message: fieldTitle + " is required" };
    }
    
    if (fieldValue.length == 0) {
        return { valid: false, message: "Please Select " + fieldTitle };
    }
    return { valid: true };
};

const validateSelectField = (fieldTitle, fieldValue) => {
    if (!fieldValue) {
        return { valid: false, message: fieldTitle + " is required" };
    }
    
    if (fieldValue.trim() === '') {
        return { valid: false, message: "Select " + fieldTitle };
    }
    return { valid: true };
};

const isValidMobileNumber = (value) => {
    const mobileRegex = /^[6-9]\d{9}$/;
    return mobileRegex.test(value);
};

const isValidEmailAddress = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
};

const determineInputType = (inputValue) => {
    if (isValidEmailAddress(inputValue)) {
        return { type: 'email', valid: true };
    } else if (isValidMobileNumber(inputValue)) {
        return { type: 'mobile', valid: true };
    } else {
        return { type: 'unknown', valid: false };
    }
};

const areAllCharactersNumbers = (input) => {
    const numberRegex = /^\d+$/; // Matches one or more digits
    return numberRegex.test(input);
};

const ftpConfig = {
    host: "uniquetechnosolutions.in",
    user: "u412475638.uniquetechnosolutions.in",
    password: "Keyur@@5201",
};

module.exports = {
    validateMobileNumber,
    validateImageList,
    validateCommonField,
    validateSelectField,
    validateEmailAddress,
    validatePassword,
    isValidMobileNumber,
    isValidEmailAddress,
    determineInputType,
    areAllCharactersNumbers,
    ftpConfig,
}