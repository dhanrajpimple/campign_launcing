require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

/* ----------------------------------------
   SES Client (uses env credentials)
---------------------------------------- */
const ses = new SESClient({
  region: process.env.AWS_REGION
});

/* ----------------------------------------
   Helper: template replace
---------------------------------------- */
function applyTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '');
}

/* ----------------------------------------
   Send bulk email via SES
---------------------------------------- */
app.post('/api/send-bulk', async (req, res) => {
  try {
    const { subject, htmlTemplate, users } = req.body;

    if (!subject || !htmlTemplate || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const results = [];

    for (const user of users) {
      if (!user.email) {
        results.push({ success: false, error: 'Missing email' });
        continue;
      }

      const command = new SendEmailCommand({
        Source: `${process.env.SES_FROM_NAME} <${process.env.SES_FROM_EMAIL}>`,
        Destination: {
          ToAddresses: [user.email]
        },
        ReplyToAddresses: [process.env.SES_REPLY_TO],
        Message: {
          Subject: {
            Data: applyTemplate(subject, user),
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: applyTemplate(htmlTemplate, user),
              Charset: 'UTF-8'
            }
          }
        }
      });

      try {
        const response = await ses.send(command);
        results.push({
          email: user.email,
          success: true,
          messageId: response.MessageId
        });
      } catch (err) {
        results.push({
          email: user.email,
          success: false,
          error: err.message
        });
      }
    }

    res.json({
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ----------------------------------------
   Health check
---------------------------------------- */
app.get('/', (_, res) => {
  res.send('AWS SES Node.js service running ✅');
});

app.listen(3000, () => {
  console.log('🚀 Server running on port 3000');
});
