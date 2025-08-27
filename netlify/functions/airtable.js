// Airtable helper for Netlify Functions
const fetch = require('node-fetch');

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE = 'Feedbacks';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;

async function addFeedback(text, stars) {
  const res = await fetch(AIRTABLE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: { text, stars, ts: Date.now() }
    })
  });
  if (!res.ok) throw new Error('Airtable POST failed');
  return await res.json();
}

async function getFeedbacks() {
  const res = await fetch(AIRTABLE_URL, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) throw new Error('Airtable GET failed');
  const data = await res.json();
  return data.records.map(r => r.fields);
}

module.exports = { addFeedback, getFeedbacks };
