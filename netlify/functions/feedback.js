// Netlify Function: feedback.js
// Handles POST (add feedback) and GET (list feedbacks)


const { addFeedback, getFeedbacks } = require('./airtable');

exports.handler = async function(event) {
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }
    const { text, stars } = body;
    if (!text || typeof stars !== 'number' || stars < 1 || stars > 5) {
      return { statusCode: 400, body: 'Missing or invalid fields' };
    }
    try {
      await addFeedback(text, stars);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, body: 'Airtable error: ' + e.message };
    }
  }
  if (event.httpMethod === 'GET') {
    try {
      const feedbacks = await getFeedbacks();
      return {
        statusCode: 200,
        body: JSON.stringify({ feedbacks }),
        headers: { 'Content-Type': 'application/json' }
      };
    } catch (e) {
      return { statusCode: 500, body: 'Airtable error: ' + e.message };
    }
  }
  return { statusCode: 405, body: 'Method Not Allowed' };
};
