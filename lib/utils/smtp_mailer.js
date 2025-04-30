const nodemailer = require('nodemailer');

const prodMailConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    // encryption: 'ssl',
    secure: true,
    // tls: {
    //     rejectUnauthorized: false
    // },
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
};

const transporter = nodemailer.createTransport(prodMailConfig);

module.exports = {
    transporter,
    sendmail: async (mailObj, successCallback, errorCallback) => {
        transporter.sendMail({
            from: mailObj.from,
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