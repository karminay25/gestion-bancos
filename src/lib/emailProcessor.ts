import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { XMLParser } from 'fast-xml-parser';
import { supabaseAdmin } from './supabase';

if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized. Please verify SUPABASE_SERVICE_ROLE_KEY.');
}
const supabase = supabaseAdmin!;

const imapConfig = {
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASS || '',
    host: process.env.EMAIL_HOST || '',
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

export async function syncInvoicesFromEmail(): Promise<string> {
    // 1. Determine search start date dynamically based on latest invoice in DB
    let searchDate = 'Jan 1, 2026';
    try {
        const { data: latestInvoice } = await supabase
            .from('facturas')
            .select('fecha_emision')
            .order('fecha_emision', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (latestInvoice?.fecha_emision) {
            const latest = new Date(latestInvoice.fecha_emision);
            // Subtract 7 days for safety margin to avoid missing late emails or timezone anomalies
            latest.setDate(latest.getDate() - 7);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            searchDate = `${months[latest.getMonth()]} ${latest.getDate()}, ${latest.getFullYear()}`;
            console.log(`Dynamic IMAP search date calculated: ${searchDate} (based on latest invoice dated ${latestInvoice.fecha_emision})`);
        } else {
            console.log('No existing invoices found in database. Defaulting search date to:', searchDate);
        }
    } catch (dbErr) {
        console.error('Failed to query latest invoice date, defaulting to Jan 1, 2026:', dbErr);
    }

    console.log('Connecting to email:', imapConfig.user);
    const imap = new Imap(imapConfig);

    return new Promise((resolve, reject) => {
        let newInvoicesCount = 0;
        const emailPromises: Promise<void>[] = [];

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) return reject(err);

                console.log(`Searching inbox for messages SINCE: ${searchDate}`);
                imap.search([['SINCE', searchDate]], (err, results) => {
                    if (err) return reject(err);
                    if (!results || results.length === 0) {
                        imap.end();
                        return resolve('No hay correos nuevos desde la fecha de búsqueda');
                    }

                    console.log(`Found ${results.length} potential messages to parse.`);
                    const f = imap.fetch(results, { 
                        bodies: '', 
                        struct: true
                    });

                    f.on('message', (msg, seqno) => {
                        const msgPromise = new Promise<void>((msgResolve) => {
                            msg.on('body', (stream) => {
                                simpleParser(stream as any, async (err, parsed) => {
                                    if (err) {
                                        msgResolve();
                                        return;
                                    }
                                    try {
                                        for (const att of parsed.attachments) {
                                            if (att.filename?.toLowerCase().endsWith('.xml')) {
                                                const inserted = await processXML(att.content.toString(), att.filename);
                                                if (inserted) newInvoicesCount++;
                                            } else if (att.filename?.toLowerCase().endsWith('.zip')) {
                                                try {
                                                    const AdmZip = require('adm-zip');
                                                    const zip = new AdmZip(att.content);
                                                    const zipEntries = zip.getEntries();
                                                    for (const zipEntry of zipEntries) {
                                                        if (zipEntry.entryName.toLowerCase().endsWith('.xml')) {
                                                            const xmlContent = zipEntry.getData().toString('utf8');
                                                            const inserted = await processXML(xmlContent, zipEntry.entryName);
                                                            if (inserted) newInvoicesCount++;
                                                        }
                                                    }
                                                } catch (zerr) {
                                                    console.error('Failed to extract ZIP:', zerr);
                                                }
                                            }
                                        }
                                    } catch (procErr) {
                                        console.error('Error processing attachments:', procErr);
                                    } finally {
                                        msgResolve();
                                    }
                                });
                            });

                            msg.once('error', () => {
                                msgResolve();
                            });
                        });
                        emailPromises.push(msgPromise);
                    });

                    f.once('error', (err) => reject(err));
                    f.once('end', async () => {
                        try {
                            console.log('Fetch stream finished. Awaiting active parsing processes...');
                            await Promise.all(emailPromises);
                            console.log('All email parsing processes completed.');
                        } catch (allErr) {
                            console.error('Error awaiting email parsing promises:', allErr);
                        } finally {
                            imap.end();
                            resolve(newInvoicesCount > 0 
                                ? `${newInvoicesCount} factura(s) nueva(s) guardada(s) con éxito`
                                : 'Sincronización al día. No se detectaron nuevas facturas'
                            );
                        }
                    });
                });
            });
        });

        imap.once('error', (err) => reject(err));
        imap.connect();
    });
}

function findNode(obj: any, keyName: string): any {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj[keyName] !== undefined) return obj[keyName];
    const lowerKey = keyName.toLowerCase();
    for (const k of Object.keys(obj)) {
        const parts = k.split(':');
        const localPart = parts[parts.length - 1];
        if (localPart.toLowerCase() === lowerKey) {
            return obj[k];
        }
    }
    return undefined;
}

function getAttr(node: any, attrName: string): any {
    if (!node || typeof node !== 'object') return undefined;
    const lowerAttr = attrName.toLowerCase();
    for (const k of Object.keys(node)) {
        if (k.startsWith('@_') && k.substring(2).toLowerCase() === lowerAttr) {
            return node[k];
        }
    }
    return undefined;
}

async function processXML(xmlContent: string, filename: string): Promise<boolean> {
    try {
        const jsonObj = xmlParser.parse(xmlContent);
        const comprobante = findNode(jsonObj, "Comprobante");
        if (!comprobante) return false;

        const timbre = findNode(findNode(comprobante, "Complemento"), "TimbreFiscalDigital");
        const uuid = getAttr(timbre, "UUID");

        if (!uuid) return false;

        // 1. QUICK CHECK: Does it already exist in DB?
        const { data: existing } = await supabase
            .from('facturas')
            .select('id')
            .eq('uuid_sat', uuid)
            .maybeSingle();

        if (existing) {
            return false;
        }

        const emisor = findNode(comprobante, "Emisor");
        const receptor = findNode(comprobante, "Receptor");

        const parsedMonto = parseFloat(getAttr(comprobante, "Total"));
        const monto_total = isNaN(parsedMonto) ? 0 : parsedMonto;

        const metadata = {
            uuid_sat: uuid,
            emisor_rfc: getAttr(emisor, "Rfc"),
            emisor_nombre: getAttr(emisor, "Nombre"),
            receptor_rfc: getAttr(receptor, "Rfc"),
            monto_total: monto_total,
            moneda: getAttr(comprobante, "Moneda") || 'MXN',
            fecha_emision: getAttr(comprobante, "Fecha")?.split('T')[0],
            folio: getAttr(comprobante, "Folio"),
            archivo_xml: filename,
            estado: 'PENDIENTE_VINCULO'
        };

        const { error } = await supabase.from('facturas').insert(metadata);
        if (error) {
            if (error.code !== '23505') { // Ignore unique constraint errors just in case
                console.error('Error saving invoice metadata:', error);
            }
            return false;
        } else {
            console.log('--- NEW INVOICE SAVED:', uuid, '---');
            return true;
        }
    } catch (e) {
        console.error('Error parsing XML:', e);
        return false;
    }
}
