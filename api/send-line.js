export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, token, channelAccessToken, userId, message } = req.body;

  // Validation
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    if (type === 'bot') {
      const activeToken = channelAccessToken || token;
      if (!activeToken || !userId) {
        return res.status(400).json({ error: 'channelAccessToken and userId are required for bot type' });
      }

      // Official LINE Messaging API Bot push
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          to: userId,
          messages: [
            {
              type: 'text',
              text: message
            }
          ]
        })
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const activeToken = token;
      if (!activeToken) {
        return res.status(400).json({ error: 'token is required for notify type' });
      }

      // LINE Notify push
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${activeToken}`
        },
        body: new URLSearchParams({ message })
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
