// import fetch from 'node-fetch'
require('dotenv').config();
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
// const fs = require('fs');
const birthdayMessages = require('./birthdayMessages');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
    sendBirthdayMessages();
});

// Event: Disconnected
client.on('disconnected', (reason) => {
    console.log('Disconnected:', reason);
});

// Start the WhatsApp client
client.initialize();

// Function to fetch Airtable records and send birthday messages
async function sendBirthdayMessages() {
    try {
        const airtableApiKey = process.env.AIRTABLE_API_KEY; 
        const baseId = process.env.AIRTABLE_BASE_ID; 
        const tableName = process.env.AIRTABLE_TABLE_ID; 
        const groupNumber = process.env.GROUP_CHAT_ID;
        const apiUrl = `https://api.airtable.com/v0/${baseId}/${tableName}`;

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${airtableApiKey}`
            }
        });

        if (!response.ok) {
            throw new Error('Error fetching data from Airtable');
        }

        const data = await response.json();

        const userInput = data.records.map(record => {
            const fields = record.fields;
            return {
                name: fields.Name,
                whatsappNumber: fields['Whatsapp Number'],
                nickname: fields.Nickname,
                dateOfBirth: fields['Date of Birth'],
                picture: fields.Picture && fields.Picture[0] && fields.Picture[0].url // Ensure Picture URL exists
            };
        });

        // Get today's date
        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();

        // Iterate through users to find whose birthday it is
        for (let user of userInput) {
            const dobMonth = user.dateOfBirth.split('-')[1];
            const dobDay = user.dateOfBirth.split('-')[2];
            const whatsappNumber = `${user.whatsappNumber}@c.us`;  // Create user's WhatsApp ID
            const picture = user.picture;
            const nickname = user.nickname;

            if (parseInt(dobMonth) === todayMonth && parseInt(dobDay) === todayDay) {
                console.log(`Today is ${user.name}'s birthday!`);

                // Select a random message from the external birthday messages array
                const randomMessage = birthdayMessages[Math.floor(Math.random() * birthdayMessages.length)];

                // Personalized message for DM
                const directMessage = `${randomMessage} Happy Birthday, ${nickname}! 🎉🎁`;

                // Send to individual user
                if (picture) {
                    await sendMedia(whatsappNumber, picture, directMessage);
                } else {
                    await sendMessage(whatsappNumber, directMessage);
                }

                // Personalized message for the group
                const groupMessage = `${randomMessage} Happy Birthday @${user.whatsappNumber}! 🎉🎂`;


                if (picture) {
                    await sendMedia(groupNumber, picture, groupMessage, [whatsappNumber]);
                } else {
                    await sendMessage(groupNumber, groupMessage, [whatsappNumber]);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Function to send media directly from URL with mention
async function sendMedia(targetNumber, picture, message, mentions = []) {
    try {
        const media = await MessageMedia.fromUrl(picture, { unsafeMime: true });  // Fetch media from the URL
        await client.sendMessage(targetNumber, media, { caption: message, mentions });  // Send media with caption and mention
        console.log(`Media sent successfully to ${targetNumber}`);
    } catch (error) {
        console.error('Error sending media:', error);
    }
}

// Function to send a plain message with mention
async function sendMessage(targetNumber, message, mentions = []) {
    try {
        await client.sendMessage(targetNumber, message, { mentions });
        console.log(`Message sent successfully to ${targetNumber}`);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}
