const Joi = require('joi');
const { validateMobileNumber, validateCommonField, validateEmailAddress, validatePassword, determineInputType, areAllCharactersNumbers, validateSelectField, validateImageList } = require('../utils/ValidationUtils');
const { handleError } = require('../utils/utils');
const jwt = require('jsonwebtoken');

const addRequestValidation = (req, res, next) => {
    const { name, mobile, address, pinCode, district, subDistrict, productName, warrantyCardImages } = req.body;

    const fullnameValidation = validateCommonField("Fullname", name);
    const mobileValidation = validateMobileNumber(mobile);
    const addressValidation = validateCommonField("Address", address);
    const pinCodeValidation = validateCommonField("Pin Code", pinCode);
    const districtValidation = validateSelectField("District", district);
    const subDistrictValidation = validateSelectField("Sub District", subDistrict);
    const productNameValidation = validateCommonField("Product Name", productName);
    const warrantyCardValidation = validateImageList("Warranty Card Image", warrantyCardImages);

    if (!fullnameValidation.valid) {
        return handleError(res, fullnameValidation.message, 400);
    }

    if (!mobileValidation.valid) {
        return handleError(res, mobileValidation.message, 400);
    }

    if (!addressValidation.valid) {
        return handleError(res, addressValidation.message, 400);
    }

    if (!pinCodeValidation.valid) {
        return handleError(res, pinCodeValidation.message, 400);
    }

    if (!districtValidation.valid) {
        return handleError(res, districtValidation.message, 400);
    }

    if (!subDistrictValidation.valid) {
        return handleError(res, subDistrictValidation.message, 400);
    }

    if (!productNameValidation.valid) {
        return handleError(res, productNameValidation.message, 400);
    }

    if (!warrantyCardValidation.valid) {
        return handleError(res, warrantyCardValidation.message, 400);
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
    addRequestValidation,
    loginValidation,
}