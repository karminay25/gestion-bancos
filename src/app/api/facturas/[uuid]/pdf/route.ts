import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabase } from '@/lib/supabase';

// GET /api/facturas/[uuid]/pdf
// Returns a signed URL for the PDF version of the factura.
export async function GET(request: NextRequest, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;

  // Obtain the factura record (archivo_xml)
  const client = supabaseAdmin ?? supabase;
    const { data: factura, error } = await client
      .from('facturas')
      .select('archivo_xml')
      .ilike('uuid_sat', uuid)
      .single();

    console.log('📄 PDF endpoint query result:', { factura, error });
    if (error || !factura) {
      if (error) console.error('❌ Query error:', error);
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    const xmlFile = factura.archivo_xml as string;
    const pdfFile = xmlFile.replace(/\.[^.]+$/, '.pdf');
    const { data: signed, error: signError } = await supabaseAdmin
      .storage
      .from('facturas')
      .createSignedUrl(pdfFile, 60);
    if (signError || !signed) {
      return NextResponse.json({ error: 'PDF no disponible' }, { status: 404 });
    }
    // Debug response
    return NextResponse.json({ factura, signedUrl: signed.signedUrl });
}
