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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { topic = 'grounding for teens', format = 'carousel' } = await readJson(req);

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  }

  const system = [
    "You help licensed clinicians create educational mental-health content.",
    "Tone: warm, validating, plain language. ~6th grade reading level.",
    "No diagnosis/treatment instructions. Include a short non-crisis disclaimer.",
    "Avoid PHI. Use inclusive, non-stigmatizing language. Keep bullets tight."
  ].join("\n");

  const user = `Make a ${format} about: ${topic}.
Return concise, numbered sections. If carousel, give 7 short slides with optional alt-text notes.
End with a one-line educational disclaimer and crisis resource example (e.g., 988 in the U.S.).`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err });
    }

    const data = await resp.json();
    const output = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ output });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
