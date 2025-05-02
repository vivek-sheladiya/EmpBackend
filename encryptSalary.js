const crypto = require('crypto');
const iv = crypto.randomBytes(16);
const algorithm = 'aes-256-cbc';
const secretKeys = '12345678901234567890123456789012';
const secretKey = crypto.createHash('sha256').update('secretKeys').digest();

function encrypt(value) {
    if (!value) return value;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(value.toString(), 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(value) {
    if (!value || !value.includes(':')) return value;
    try {
        const [ivHex, encryptedData] = value.split(':');
        const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(ivHex, 'hex'));
        let decrypted = decipher.update(encryptedData, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    } catch (err) {
        return value;
    }
}

module.exports = {
    encrypt,
    decrypt,
};
