import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { XMLParser } from 'fast-xml-parser';
import { supabaseAdmin as supabase } from './supabase';

const imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 30000,
    authTimeout: 30000
};

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
});

export async function syncInvoicesFromEmail() {
    console.log('Connecting to email:', imapConfig.user);
    
    const imap = new Imap(imapConfig);

    return new Promise((resolve, reject) => {
        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) return reject(err);

                // Search for unread messages or from last X days
                // For now, let's look for emails with attachments
                // Search for ONLY unread messages to avoid re-processing
                imap.search(['UNSEEN'], (err, results) => {
                    if (err) return reject(err);
                    if (!results || results.length === 0) {
                        imap.end();
                        return resolve('No new emails');
                    }

                    const f = imap.fetch(results, { 
                        bodies: '', 
                        struct: true, 
                        markSeen: true // Automatically mark as read when fetched
                    });

                    f.on('message', (msg, seqno) => {
                        msg.on('body', (stream) => {
                            simpleParser(stream, async (err, parsed) => {
                                if (err) return;
                                
                                for (const att of parsed.attachments) {
                                    if (att.filename?.toLowerCase().endsWith('.xml')) {
                                        await processXML(att.content.toString(), att.filename);
                                    }
                                }
                            });
                        });
                    });

                    f.once('error', (err) => reject(err));
                    f.once('end', () => {
                        imap.end();
                        resolve('Sync complete');
                    });
                });
            });
        });

        imap.once('error', (err) => reject(err));
        imap.connect();
    });
}

async function processXML(xmlContent: string, filename: string) {
    try {
        const jsonObj = xmlParser.parse(xmlContent);
        const comprobante = jsonObj["cfdi:Comprobante"];
        if (!comprobante) return;

        const timbre = comprobante["cfdi:Complemento"]?.["tfd:TimbreFiscalDigital"];
        const uuid = timbre?.["@_UUID"];

        if (!uuid) return;

        // 1. QUICK CHECK: Does it already exist in DB?
        const { data: existing } = await supabase
            .from('facturas')
            .select('id')
            .eq('uuid_sat', uuid)
            .maybeSingle();

        if (existing) {
            // console.log('Invoice already exists, skipping:', uuid);
            return;
        }

        const emisor = comprobante["cfdi:Emisor"];
        const receptor = comprobante["cfdi:Receptor"];

        const metadata = {
            uuid_sat: uuid,
            emisor_rfc: emisor?.["@_Rfc"],
            emisor_nombre: emisor?.["@_Nombre"],
            receptor_rfc: receptor?.["@_Rfc"],
            monto_total: parseFloat(comprobante["@_Total"]),
            moneda: comprobante["@_Moneda"],
            fecha_emision: comprobante["@_Fecha"]?.split('T')[0],
            folio: comprobante["@_Folio"],
            archivo_xml: filename,
            estado: 'PENDIENTE_VINCULO'
        };

        const { error } = await supabase.from('facturas').insert(metadata);
        if (error) {
            if (error.code !== '23505') { // Ignore unique constraint errors just in case
                console.error('Error saving invoice metadata:', error);
            }
        } else {
            console.log('--- NEW INVOICE SAVED:', uuid, '---');
        }
    } catch (e) {
        console.error('Error parsing XML:', e);
    }
}
