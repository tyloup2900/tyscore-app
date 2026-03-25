import { supabase } from '@/lib/supabase';
import { jsonResponse, errorResponse, OPTIONS } from '@/lib/api-helpers';

export { OPTIONS };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const skills = searchParams.get('skills');          // comma-separated
  const categories = searchParams.get('categories');  // comma-separated
  const platform = searchParams.get('platform');      // "claude", "gpt", etc.
  const country = searchParams.get('country');        // "FR"
  const region = searchParams.get('region');          // "bretagne"
  const minScore = searchParams.get('min_score');     // "4.0"
  const maxPrice = searchParams.get('max_price');     // cents
  const verified = searchParams.get('verified');      // "true"
  const protocol = searchParams.get('protocol');      // "a2a", "rest"
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('agents')
    .select('id, name, description, provider, platform, skills, categories, score, reliability, quality, speed_score, security_grade, total_ratings, success_rate, avg_response_ms, verified, featured, endpoint_url, protocol, pricing_model, price_cents, currency')
    .eq('active', true)
    .order('featured', { ascending: false })  // Featured first
    .order('score', { ascending: false })      // Then by score
    .range(offset, offset + limit - 1);

  // Apply filters
  if (skills) {
    const skillList = skills.split(',').map(s => s.trim().toLowerCase());
    query = query.overlaps('skills', skillList);
  }
  
  if (categories) {
    const catList = categories.split(',').map(c => c.trim().toLowerCase());
    query = query.overlaps('categories', catList);
  }
  
  if (platform) query = query.eq('platform', platform);
  if (country) query = query.eq('country', country);
  if (region) query = query.eq('region', region.toLowerCase());
  if (minScore) query = query.gte('score', parseFloat(minScore));
  if (maxPrice) query = query.lte('price_cents', parseInt(maxPrice));
  if (verified === 'true') query = query.eq('verified', true);
  if (protocol) query = query.eq('protocol', protocol);

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(error.message, 500);
  }

  return jsonResponse({
    results: (data || []).map(agent => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      platform: agent.platform,
      skills: agent.skills,
      categories: agent.categories,
      trust_score: agent.score,
      reliability: agent.reliability,
      quality: agent.quality,
      speed: agent.speed_score,
      security: agent.security_grade,
      total_ratings: agent.total_ratings,
      success_rate: agent.success_rate,
      verified: agent.verified,
      featured: agent.featured,
      endpoint_url: agent.endpoint_url,
      protocol: agent.protocol,
      pricing: {
        model: agent.pricing_model,
        price_cents: agent.price_cents,
        currency: agent.currency,
      },
      score_url: `https://ty-score.com/v1/score/${agent.id}`,
    })),
    total: (data || []).length,
    limit,
    offset,
  });
}
