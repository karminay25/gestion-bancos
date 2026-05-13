import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: 'No code provided' }, { status: 400 });
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/callback/microsoft`;

  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Mail.Read',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
        return NextResponse.json({ tokens }, { status: 400 });
    }

    // Save tokens to Supabase
    const { error: dbError } = await supabase
      .from('sistema_config')
      .upsert({
        id: 'microsoft_auth',
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          ext_expires_in: tokens.ext_expires_in,
          updated_at: new Date().toISOString(),
        }
      });

    if (dbError) {
      return NextResponse.json({ error: 'Failed to save tokens', details: dbError }, { status: 500 });
    }

    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff;">
          <h1 style="color: #10b981;">✅ Autenticación Exitosa</h1>
          <p>El sistema ya tiene permisos para leer los correos de facturación.</p>
          <p>Puedes cerrar esta ventana y volver al sistema.</p>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (err: any) {
    return NextResponse.json({ error: 'Token exchange failed', details: err.message }, { status: 500 });
  }
}
