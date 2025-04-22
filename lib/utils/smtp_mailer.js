const nodemailer = require('nodemailer');

const prodMailConfig = {
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    secure: false,
    auth: {
        user: process.env.USER_NAME,
        pass: process.env.PASSWORD
    },
};

const transporter = nodemailer.createTransport(prodMailConfig);

module.exports = {
    sendmail: async (mailObj, successCallback, errorCallback) => {
        transporter.sendMail({
            from: {
                email: 'teqheal@gmail.com',
                name: 'teqheal tracker'
            },
            to: mailObj.to,
            subject: mailObj.subject,
            text: mailObj.text,
            html: mailObj.html,
            attachments: mailObj.attachments
        }).then(success => {
            successCallback(success);
        }).catch(error => {
            errorCallback(error);
        });
    }
}