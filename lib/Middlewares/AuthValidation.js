const Joi = require('joi');
const { validateMobileNumber, validateCommonField, validateEmailAddress, validatePassword, determineInputType, areAllCharactersNumbers } = require('../utils/ValidationUtils');
const { handleError } = require('../utils/utils');

const signupValidation = (req, res, next) => {
    const { fullName, emailAddress, mobileNumber, password } = req.body;

    const fullnameValidation = validateCommonField("Fullname", fullName);
    const emailValidation = validateEmailAddress(emailAddress);
    const mobileValidation = validateMobileNumber(mobileNumber);
    const passwordValidation = validatePassword(password);

    if (!fullnameValidation.valid) {
        return handleError(res, fullnameValidation.message, 400);
    }

    if (!emailValidation.valid) {
        return handleError(res, emailValidation.message, 400);
    }

    if (!mobileValidation.valid) {
        return handleError(res, mobileValidation.message, 400);
    }

    if (!passwordValidation.valid) {
        return handleError(res, passwordValidation.message, 400);
    }
    
    next();
}

const addUserValidation = (req, res, next) => {
    const { fullName, emailAddress, mobileNumber, password } = req.body;

    const fullnameValidation = validateCommonField("Fullname", fullName);
    const emailValidation = validateEmailAddress(emailAddress);
    const mobileValidation = validateMobileNumber(mobileNumber);
    const passwordValidation = validatePassword(password);

    if (!fullnameValidation.valid) {
        return handleError(res, fullnameValidation.message, 400);
    }

    if (!emailValidation.valid) {
        return handleError(res, emailValidation.message, 400);
    }

    if (!mobileValidation.valid) {
        return handleError(res, mobileValidation.message, 400);
    }

    if (!passwordValidation.valid) {
        return handleError(res, passwordValidation.message, 400);
    }
    
    next();
}

const loginValidation = (req, res, next) => {
    const { loginId, password } = req.body;

    const isMobileNumber = areAllCharactersNumbers(loginId);
    
    let validationResult;

    if (isMobileNumber) {
        validationResult = validateMobileNumber(loginId);
        if (!validationResult.valid) {
            return handleError(res, validationResult.message, 400);
        }
    } else {
        validationResult = validateEmailAddress(loginId);
        if (!validationResult.valid) {
            return handleError(res, validationResult.message, 400);
        }
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
        return handleError(res, passwordValidation.message, 400);
    }
    
    next();
}

module.exports = {
    signupValidation,
    addUserValidation,
    loginValidation
}