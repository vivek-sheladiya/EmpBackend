const axios = require('axios');

const onesignalApiKey = 'YjA0MWM5ZDgtZTc3ZS00NWE5LTg2ZjMtZDU4MWQ2YmZjMWZi';
const onesignalAppId = '65cb69b8-e8db-4169-8116-37f3fbbabe47';

const sendNotification = async (description, title, playerIds, additionalData, bigImage, largeIcon) => {
    const notificationData = {
        app_id: onesignalAppId,
        contents: {
            en: description,
        },
        headings: {
            en: title,
        },
        ...(playerIds == null || playerIds.length === 0
            ? { included_segments: ['All'] }
            : { include_player_ids: playerIds }),
        ...(additionalData != null ? { data: additionalData } : {}),
        ...(bigImage != null ? { big_picture: bigImage } : {}),
        ...(largeIcon != null ? { large_icon: largeIcon } : {}),
        // android_channel_id: '0c37ff3c-59dd-4b1b-81a9-8d1328a6e8bc',
    };

    try {
        const response = await axios.post('https://onesignal.com/api/v1/notifications', notificationData, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${onesignalApiKey}`,
            },
        });

        console.log('Notification sent successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error sending notification:', error);
        throw error;
    }
};

const notifyUsers = async () => {
    const description = 'Your notification description';
    const title = 'Your notification title';
    const playerIds = ['65cb69b8-e8db-4169-8116-37f3fbbabe47']; // Replace with actual player IDs
    const additionalData = { key: 'value' }; // Replace with actual additional data
    const bigImage = 'https://example.com/path/to/big/image.png'; // Replace with actual image URL
    const largeIcon = 'https://example.com/path/to/large/icon.png'; // Replace with actual icon URL

    try {
        const result = await sendNotification(
            description,
            title,
            // [],
            playerIds,
            additionalData,
            bigImage,
            largeIcon
        );

        console.log('Notification result:', result);
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
};



module.exports = {
    sendNotification,
    notifyUsers
};