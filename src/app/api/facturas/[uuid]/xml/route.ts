import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

// GET /api/facturas/[uuid]/xml
// Returns a signed URL for the raw CFDI XML of the factura.
export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;

  const client = supabaseAdmin ?? supabase;
  const { data: factura, error } = await client
    .from('facturas')
    .select('archivo_xml')
    .ilike('uuid_sat', uuid)
    .single();

  if (error || !factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  }

  const xmlFile = factura.archivo_xml as string | null;
  if (!xmlFile) {
    return NextResponse.json({ error: 'Esta factura no tiene un XML guardado' }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabaseAdmin
    .storage
    .from('facturas')
    .createSignedUrl(xmlFile, 60);
  if (signError || !signed) {
    return NextResponse.json({ error: 'XML no disponible (probablemente sincronizado antes de guardar el archivo real)' }, { status: 404 });
  }
  return NextResponse.json({ signedUrl: signed.signedUrl });
}
