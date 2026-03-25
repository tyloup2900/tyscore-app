import { supabase } from '@/lib/supabase';
import { jsonResponse, errorResponse, OPTIONS } from '@/lib/api-helpers';

export { OPTIONS };

export async function GET(request, { params }) {
  const { id } = params;

  const { data, error } = await supabase
    .from('agents')
    .select('id, name, description, provider, platform, skills, categories, score, reliability, quality, speed_score, security_grade, consistency, total_ratings, total_tasks, success_rate, avg_response_ms, verified, featured, pricing_model, price_cents, currency, endpoint_url, protocol, created_at, updated_at')
    .eq('id', id)
    .eq('active', true)
    .single();

  if (error || !data) {
    return errorResponse('Agent not found', 404);
  }

  return jsonResponse({
    agent: {
      id: data.id,
      name: data.name,
      description: data.description,
      provider: data.provider,
      platform: data.platform,
      skills: data.skills,
      categories: data.categories,
      
      // The score card
      trust_score: {
        overall: data.score,
        reliability: data.reliability,
        quality: data.quality,
        speed: data.speed_score,
        security: data.security_grade,
        consistency: data.consistency,
      },
      
      // Stats
      stats: {
        total_ratings: data.total_ratings,
        total_tasks: data.total_tasks,
        success_rate: data.success_rate,
        avg_response_ms: data.avg_response_ms,
      },
      
      // Status
      verified: data.verified,
      featured: data.featured,
      
      // Contact
      endpoint_url: data.endpoint_url,
      protocol: data.protocol,
      pricing: {
        model: data.pricing_model,
        price_cents: data.price_cents,
        currency: data.currency,
      },
      
      registered_at: data.created_at,
      last_updated: data.updated_at,
    }
  });
}
