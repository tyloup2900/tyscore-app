import { supabase } from '@/lib/supabase';
import { jsonResponse, errorResponse, OPTIONS } from '@/lib/api-helpers';

export { OPTIONS };

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

  let query = supabase
    .from('agents')
    .select('id, name, description, platform, skills, categories, score, reliability, quality, speed_score, security_grade, total_ratings, success_rate, verified, featured')
    .eq('active', true)
    .gt('total_ratings', 0)
    .order('score', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.contains('categories', [category.toLowerCase()]);
  }

  const { data, error } = await query;

  if (error) {
    return errorResponse(error.message, 500);
  }

  return jsonResponse({
    leaderboard: (data || []).map((agent, index) => ({
      rank: index + 1,
      id: agent.id,
      name: agent.name,
      platform: agent.platform,
      categories: agent.categories,
      trust_score: agent.score,
      reliability: agent.reliability,
      total_ratings: agent.total_ratings,
      success_rate: agent.success_rate,
      verified: agent.verified,
      score_url: `https://ty-score.com/v1/score/${agent.id}`,
    })),
    category: category || 'all',
    total: (data || []).length,
  });
}
