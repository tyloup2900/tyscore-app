import { supabase } from '@/lib/supabase';
import { jsonResponse, errorResponse, OPTIONS } from '@/lib/api-helpers';

export { OPTIONS };

export async function GET(request, { params }) {
  const { id } = params;

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .single();

  if (error || !data) {
    return errorResponse('Agent not found', 404);
  }

  // Remove sensitive fields
  const { api_key, owner_email, ...publicData } = data;

  return jsonResponse({ agent: publicData });
}

export async function PATCH(request, { params }) {
  const { id } = params;
  
  // Authenticate via API key
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey) {
    return errorResponse('Missing X-API-Key header', 401);
  }

  // Verify API key matches agent
  const { data: agent, error: authError } = await supabase
    .from('agents')
    .select('id, api_key')
    .eq('id', id)
    .single();

  if (authError || !agent) {
    return errorResponse('Agent not found', 404);
  }

  if (agent.api_key !== apiKey) {
    return errorResponse('Invalid API key', 403);
  }

  try {
    const body = await request.json();
    
    // Only allow updating certain fields
    const allowedFields = [
      'name', 'description', 'skills', 'categories', 'languages',
      'endpoint_url', 'protocol', 'auth_type', 'agent_card_url',
      'pricing_model', 'price_cents', 'currency', 'region', 'country'
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', id)
      .select('id, name, score, updated_at')
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    return jsonResponse({
      agent: data,
      message: 'Agent updated successfully.',
    });

  } catch (err) {
    return errorResponse('Invalid JSON body', 400);
  }
}
