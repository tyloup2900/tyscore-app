import { NextResponse } from 'next/server';

export function jsonResponse(data, status = 200) {
  return NextResponse.json({
    ok: status < 400,
    ...data,
    _meta: {
      service: 'TyScore',
      version: '1.0.0',
      docs: 'https://ty-score.com',
      timestamp: new Date().toISOString(),
    }
  }, { status });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// CORS handler for OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    },
  });
}
