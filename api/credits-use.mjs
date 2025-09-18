// api/credits-use.mjs
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1) Validate the user from the bearer token
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    // Use anon client just to validate the token
    const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' });

    // 2) Use service role to atomically check tier/credits and decrement
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Fetch current profile
    const { data: profile, error: profErr } = await admin
      .from('profiles').select('tier, credits').eq('user_id', user.id).single();
    if (profErr || !profile) throw profErr || new Error('Profile not found');

    // Simple rule set: free users must have credits > 0; paid tiers can also consume credits (or skip)
    const isPaid = profile.tier !== 'free';
    if (!isPaid && profile.credits <= 0) {
      return res.status(402).json({ error: 'No credits', code: 'NO_CREDITS' });
    }

    // Decrement if you want *all* tiers to consume; or wrap in `if (!isPaid) { ... }`
    const { error: updErr, data: updated } = await admin
      .from('profiles')
      .update({ credits: profile.credits - 1, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .select('tier, credits')
      .single();
    if (updErr) throw updErr;

    return res.status(200).json({ ok: true, profile: updated });
  } catch (e) {
    console.error('credits-use error', e);
    return res.status(500).json({ error: e.message || 'Unknown error' });
  }
}
