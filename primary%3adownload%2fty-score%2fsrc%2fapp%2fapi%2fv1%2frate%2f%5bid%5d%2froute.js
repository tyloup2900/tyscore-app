import { supabase } from '@/lib/supabase';
import { jsonResponse, errorResponse, OPTIONS } from '@/lib/api-helpers';

export { OPTIONS };

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const body = await request.json();

    // Validate required fields
    if (typeof body.success !== 'boolean') {
      return errorResponse('Missing required field: success (boolean)');
    }

    // Verify target agent exists
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return errorResponse('Agent not found', 404);
    }

    const ratingData = {
      from_agent_id: body.from_agent_id || '00000000-0000-0000-0000-000000000000',
      from_agent_name: body.from_agent_name || 'anonymous',
      to_agent_id: id,
      success: body.success,
      quality_score: body.quality_score || (body.success ? 4 : 2),
      speed_ms: body.speed_ms || null,
      task_description: body.task_description || null,
      data_leak_detected: body.data_leak_detected || false,
      prompt_injection_detected: body.prompt_injection_detected || false,
    };

    // Validate quality score range
    if (ratingData.quality_score < 1 || ratingData.quality_score > 5) {
      return errorResponse('quality_score must be between 1 and 5');
    }

    const { data, error } = await supabase
      .from('ratings')
      .insert(ratingData)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message, 500);
    }

    // Fetch updated score
    const { data: updatedAgent } = await supabase
      .from('agents')
      .select('score, total_ratings, success_rate')
      .eq('id', id)
      .single();

    return jsonResponse({
      rating: {
        id: data.id,
        to_agent_id: id,
        success: data.success,
        quality_score: data.quality_score,
      },
      updated_score: updatedAgent ? {
        overall: updatedAgent.score,
        total_ratings: updatedAgent.total_ratings,
        success_rate: updatedAgent.success_rate,
      } : null,
      message: 'Rating recorded. Agent score updated.',
    }, 201);

  } catch (err) {
    return errorResponse('Invalid JSON body', 400);
  }
}
