const express = require('express');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/* --------------------------------------------------
   1. OAuth2 Client (Desktop client + localhost redirect)
-------------------------------------------------- */

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://campign-launcing.onrender.com/oauth2callback'
);

// Attach refresh token if already present
if (process.env.GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN
  });
}

/* --------------------------------------------------
   2. Gmail API client
-------------------------------------------------- */

const gmail = google.gmail({
  version: 'v1',
  auth: oauth2Client
});

/* --------------------------------------------------
   3. Helper: create raw email
-------------------------------------------------- */

function createRawEmail(to, subject, html) {
  const message = [
    `From: ${process.env.GMAIL_SENDER_EMAIL}`,
    `To: ${to}`,
    `Reply-To: ${process.env.GMAIL_SENDER_EMAIL}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html
  ].join('\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/* --------------------------------------------------
   4. STEP 1: Generate Google OAuth URL
-------------------------------------------------- */

app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    prompt: 'consent'
  });

  res.redirect(authUrl);
});

/* --------------------------------------------------
   5. STEP 2: OAuth callback → get refresh token
-------------------------------------------------- */

app.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const { tokens } = await oauth2Client.getToken(code);

    console.log('TOKENS RECEIVED:', tokens);

    res.send(`
      <h2>Authorization successful ✅</h2>
      <p>Copy this refresh token and save it in your <b>.env</b> file:</p>
      <pre style="background:#f4f4f4;padding:12px">
GMAIL_REFRESH_TOKEN=${tokens.refresh_token}
      </pre>
      <p>Restart the server after saving.</p>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
});

/* --------------------------------------------------
   6. Send test email
-------------------------------------------------- */

app.get('/send-test', async (req, res) => {
  try {
    const raw = createRawEmail(
      process.env.GMAIL_SENDER_EMAIL,
      'Gmail API Test Email',
      '<h2>Email sent successfully 🎉</h2>'
    );

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    });

    res.json({
      success: true,
      messageId: result.data.id
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/* --------------------------------------------------
   7. Health check
-------------------------------------------------- */

function applyTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] || '';
  });
}


app.post('/api/send-bulk', express.json(), async (req, res) => {
  try {
    const { subject, htmlTemplate, users } = req.body;

    if (!subject || !htmlTemplate || !Array.isArray(users)) {
      return res.status(400).json({
        success: false,
        error: 'subject, htmlTemplate and users[] are required'
      });
    }

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'users list cannot be empty'
      });
    }

    if (users.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Gmail API limit: max 50 emails per request'
      });
    }

    const results = [];

    for (const user of users) {
      if (!user.email) {
        results.push({
          email: null,
          success: false,
          error: 'Missing email'
        });
        continue;
      }

      const finalSubject = applyTemplate(subject, user);
      const finalHtml = applyTemplate(htmlTemplate, user);

      const raw = createRawEmail(user.email, finalSubject, finalHtml);

      try {
        const response = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw }
        });

        results.push({
          email: user.email,
          success: true,
          messageId: response.data.id
        });

        // small delay to avoid rate limit
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        results.push({
          email: user.email,
          success: false,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



app.get('/', (req, res) => {
  res.send('Gmail API backend running ✅');
});

/* --------------------------------------------------
   8. Start server
-------------------------------------------------- */

app.listen(PORT, () => {
  console.log(`🚀 Server running at https://campign-launcing.onrender.com`);
  if (!process.env.GMAIL_REFRESH_TOKEN) {
    console.log('⚠️  Visit /auth/google to generate refresh token');
  }
});
