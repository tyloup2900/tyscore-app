import { supabase } from '@/lib/supabase';
import { jsonResponse, errorResponse, OPTIONS } from '@/lib/api-helpers';

export { OPTIONS };

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.endpoint_url) {
      return errorResponse('Missing required fields: name, endpoint_url');
    }

    const agentData = {
      name: body.name,
      description: body.description || '',
      provider: body.provider || 'independent',
      platform: body.platform || 'multi',
      skills: body.skills || [],
      categories: body.categories || [],
      languages: body.languages || ['fr'],
      country: body.country || 'FR',
      region: body.region || null,
      endpoint_url: body.endpoint_url,
      protocol: body.protocol || 'rest',
      auth_type: body.auth_type || 'api_key',
      agent_card_url: body.agent_card_url || null,
      pricing_model: body.pricing_model || 'free',
      price_cents: body.price_cents || 0,
      currency: body.currency || 'EUR',
      owner_email: body.owner_email || null,
    };

    const { data, error } = await supabase
      .from('agents')
      .insert(agentData)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({
      agent: {
        id: data.id,
        name: data.name,
        api_key: data.api_key, // Only returned on registration
        score: data.score,
        endpoint_url: data.endpoint_url,
        score_url: `https://ty-score.com/v1/score/${data.id}`,
      },
      message: 'Agent registered successfully. Save your api_key — it will not be shown again.',
    }, 201);

  } catch (err) {
    return errorResponse('Invalid JSON body', 400);
  }
}
