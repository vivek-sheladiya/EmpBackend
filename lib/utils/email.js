const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const { otpEmail } = require('./emailFormat');

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendVerificationEmail = async (email, token) => {
    const url = `${process.env.BASE_URL}auth/verifyEmail/${token}`;
    const mailOptions = {
        from: process.env.SMTP_FROM_NAME + " " + process.env.SMTP_USER,
        to: email,
        subject: 'Email Verification',
        html: `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.response);
        return { success: true, message: 'Email sent successfully', info };
    } catch (error) {
        console.error('Failed to send email:', error);
        return { success: false, message: 'Failed to send email', error };
    }
};

const sendOtpEmail = async (email, fullName, companyName, otp) => {
    const mailOptions = {
        from: process.env.SMTP_FROM_NAME + " " + process.env.SMTP_USER,
        to: email,
        subject: 'Email Verification',
        html: otpEmail(fullName, companyName, otp),
    };

    // try {
        /* const info =  */await transporter.sendMail(mailOptions);
    //     console.log('Email sent successfully:', info.response);
    //     return { success: true, message: 'OTP email sent successfully', info };
    // } catch (error) {
    //     console.error('Failed to send email:', error);
    //     return { success: false, message: 'Failed to send OTP email', error };
    // }
};

module.exports = { 
    sendVerificationEmail,
    sendOtpEmail,
};
