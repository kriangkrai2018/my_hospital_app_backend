const pool = require('../config/config');
const promisePool = pool.promise();

async function createNotification(message, link = null) {
    try {
        // 1. Find all admins
        const [admins] = await promisePool.query("SELECT user_id FROM users WHERE role = 'admin'");
        if (admins.length === 0) return;

        // 2. Create a notification for each admin
        const adminIds = admins.map(admin => admin.user_id);
        const notificationValues = adminIds.map(id => [id, message, link]);
        
        await promisePool.query(
            'INSERT INTO notifications (user_id, message, link) VALUES ?',
            [notificationValues]
        );
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
}

module.exports = { createNotification };