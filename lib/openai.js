const OPENAI_URL = 'https://api.openai.com/v1/responses';

function getModel() {
  return process.env.OPENAI_MODEL || 'gpt-5-mini';
}

function isConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function isAuthorized(req) {
  const expected = process.env.CLIPPING_HQ_ACCESS_KEY;
  if (!expected) return true;
  const provided = req.headers['x-hq-key'];
  return typeof provided === 'string' && provided === expected;
}

function extractText(data) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

async function createResponse({ input, tools }) {
  if (!isConfigured()) throw new Error('OPENAI_API_KEY is not configured');
  const body = { model: getModel(), input };
  if (tools) body.tools = tools;
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI request failed (${response.status})`;
    throw new Error(message);
  }
  return extractText(data);
}

module.exports = { createResponse, getModel, isConfigured, isAuthorized };
