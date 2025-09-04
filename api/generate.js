// Robust body parsing for Vercel Node functions
async function readJson(req) {
  return await new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST' });
  }

  const payload = await readJson(req);
  const { topic = 'topic', format = 'carousel' } = payload;

  const sample = `Sample (${format}) for: ${topic}

1) Hook: Anxiety spiking? Try this.
2) See 5 things...
3) Feel 4 things...
4) Hear 3 things...
5) Smell 2 things...
6) Taste 1 thing...
— Disclaimer: Educational only. Call/text 988 (US) in crisis.`;

  return res.status(200).json({ output: sample });
}
