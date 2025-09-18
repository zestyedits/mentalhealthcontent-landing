// api/waitlist.mjs
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle JSON or form-encoded
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : (req.body || {});

    const email = (body.email || '').trim();
    const role  = (body.role || '').trim() || null;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Server-side Supabase client uses the SERVICE ROLE key (never expose in browser)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase
      .from('waitlist')
      .insert([{ email, role, source: 'landing' }]);

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('waitlist API error:', e);
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
