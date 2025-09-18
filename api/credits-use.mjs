// api/credits-use.mjs
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // --- 1) Validate the user from the bearer token (sent from the browser) ---
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    // Use anon client to validate session
    const anon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) return res.status(401).json({ error: 'Invalid session' });

    // --- 2) Use service role for privileged updates ---
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Ensure profile exists (backfill for legacy users)
    let { data: profile, error: profErr } = await admin
      .from('profiles')
      .select('tier, credits')
      .eq('user_id', user.id)
      .maybeSingle(); // <- tolerate 0 rows without throwing

    if (profErr) throw profErr;

    if (!profile) {
      // Create a default profile
      const { data: inserted, error: insertErr } = await admin
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          tier: 'free',
          credits: 10
        })
        .select('tier, credits')
        .single();
      if (insertErr) throw insertErr;
      profile = inserted;
    }

    const isPaid = profile.tier !== 'free';

    // Free users must have credits
    if (!isPaid && profile.credits <= 0) {
      return res.status(402).json({ error: 'No credits', code: 'NO_CREDITS' });
    }

    // Decrement credits for everyone right now (you can change this rule)
    const newCredits = profile.credits - 1;

    const { data: updated, error: updErr } = await admin
      .from('profiles')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
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
