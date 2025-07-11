const { validateMobileNumber, validateCommonField, validateEmailAddress, validatePassword, areAllCharactersNumbers } = require('../utils/ValidationUtils');
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
    const { loginId, emailAddress, password } = req.body;

    const email = loginId || emailAddress;

    const isMobileNumber = areAllCharactersNumbers(email);
    
    let validationResult;

    if (isMobileNumber) {
        validationResult = validateMobileNumber(email);
        if (!validationResult.valid) {
            return handleError(res, validationResult.message, 400);
        }
    } else {
        validationResult = validateEmailAddress(email);
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