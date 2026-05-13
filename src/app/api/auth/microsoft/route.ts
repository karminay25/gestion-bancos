import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/microsoft`;
  
  if (!clientId) {
    return NextResponse.json({ error: 'MICROSOFT_CLIENT_ID not configured' }, { status: 500 });
  }

  // Scopes needed to read mail and maintain access
  const scopes = ['offline_access', 'https://graph.microsoft.com/Mail.Read'].join(' ');
  
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` + 
    new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: scopes,
      state: '12345', // In production, use a random state
    }).toString();

  return NextResponse.redirect(authUrl);
}
