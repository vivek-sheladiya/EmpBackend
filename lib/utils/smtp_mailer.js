const nodemailer = require('nodemailer');
const ejs = require("ejs");

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

const sendLeaveEmail = async ({ template, subject, to, from, data }) => {
    try {
        const html = await ejs.renderFile(`emailtemplates/${template}.ejs`, data);
        await sendmail({
                from: `Teqheal ${process.env.SMTP_USER}`,
                to,
                subject,
                text: '',
                html
            },
            (success) => console.log("Email sent successfully"),
            (error) => console.error("Failed to send email", error));
    } catch (error) {
        console.error("Error rendering email:", error);
    }
};

const sendmail = async (mailObj, successCallback, errorCallback) => {
    // transporter.sendMail({
    //     from: mailObj.from,
    //     to: mailObj.to,
    //     subject: mailObj.subject,
    //     text: mailObj.text,
    //     html: mailObj.html,
    //     attachments: mailObj.attachments
    // }).then(success => {
    //     successCallback(success);
    // }).catch(error => {
    //     errorCallback(error);
    // });
};

module.exports = {
    transporter,
    sendLeaveEmail,
}