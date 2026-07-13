import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { XMLParser } from 'fast-xml-parser';
import { supabaseAdmin } from './supabase';

if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not initialized. Please verify SUPABASE_SERVICE_ROLE_KEY.');
}
const supabase = supabaseAdmin!;

// Helper function to build IMAP configs from environment variables
function getImapConfigs() {
    const configs = [];
    
    // Config 1: Default (Gmail)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST) {
        configs.push({
            user: process.env.EMAIL_USER,
            password: process.env.EMAIL_PASS,
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '993'),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 30000,
            authTimeout: 30000,
            name: 'Cuenta Principal (Gmail)'
        });
    }

    // Config 2: Outlook
    if (process.env.EMAIL2_USER && process.env.EMAIL2_PASS && process.env.EMAIL2_HOST) {
        configs.push({
            user: process.env.EMAIL2_USER,
            password: process.env.EMAIL2_PASS,
            host: process.env.EMAIL2_HOST,
            port: parseInt(process.env.EMAIL2_PORT || '993'),
            tls: true,
            tlsOptions: { rejectUnauthorized: false },
            connTimeout: 30000,
            authTimeout: 30000,
            name: 'Cuenta Secundaria (Outlook)'
        });
    }

    return configs;
}

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
});

export interface SyncResult {
    emailsScanned: number;
    xmlsFound: number;
    alreadyInDB: number;
    newSaved: number;
    message: string;
}

export async function syncInvoicesFromEmail(): Promise<SyncResult> {
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

    const imapConfigs = getImapConfigs();
    if (imapConfigs.length === 0) {
        return {
            emailsScanned: 0, xmlsFound: 0, alreadyInDB: 0, newSaved: 0,
            message: 'No hay cuentas de correo configuradas en el sistema.'
        };
    }

    let totalScanned = 0;
    let totalXmls = 0;
    let totalAlreadyInDB = 0;
    let totalNewSaved = 0;

    for (const config of imapConfigs) {
        console.log(`\n--- Sincronizando: ${config.name} (${config.user}) ---`);
        try {
            const result = await fetchFromAccount(config, searchDate);
            totalScanned += result.emailsScanned;
            totalXmls += result.xmlsFound;
            totalAlreadyInDB += result.alreadyInDB;
            totalNewSaved += result.newSaved;
        } catch (e) {
            console.error(`Error sincronizando cuenta ${config.user}:`, e);
            // Continue with other accounts even if one fails
        }
    }

    const message = totalNewSaved > 0 
        ? `${totalNewSaved} factura(s) nueva(s) guardada(s)`
        : totalAlreadyInDB > 0
        ? `Correos al día: ${totalAlreadyInDB} factura(s) ya estaban en el sistema`
        : 'No se encontraron facturas XML en los correos';

    return {
        emailsScanned: totalScanned,
        xmlsFound: totalXmls,
        alreadyInDB: totalAlreadyInDB,
        newSaved: totalNewSaved,
        message
    };
}

function findAttachments(struct: any, attachments: any[] = []): any[] {
    if (!struct) return attachments;
    for (let i = 0; i < struct.length; i++) {
        if (Array.isArray(struct[i])) {
            findAttachments(struct[i], attachments);
        } else if (struct[i] && typeof struct[i] === 'object') {
            const part = struct[i];
            if (part.disposition && ['ATTACHMENT', 'INLINE'].includes(part.disposition.type.toUpperCase())) {
                attachments.push(part);
            } else if (part.params && (part.params.name || part.params.filename)) {
                attachments.push(part);
            }
        }
    }
    return attachments;
}

async function fetchFromAccount(config: any, searchDate: string): Promise<SyncResult> {
    console.log('Connecting to email:', config.user);
    const imap = new Imap(config);

    return new Promise((resolve, reject) => {
        let newInvoicesCount = 0;
        let alreadyInDBCount = 0;
        let xmlsFoundCount = 0;
        let emailsScanned = 0;
        let isDone = false;

        const safeReject = (err: any) => {
            if (isDone) return;
            isDone = true;
            try { imap.end(); } catch (e) {}
            reject(err);
        };

        const safeResolve = (val: SyncResult) => {
            if (isDone) return;
            isDone = true;
            try { imap.end(); } catch (e) {}
            resolve(val);
        };

        imap.once('ready', () => {
            imap.openBox('INBOX', false, (err, box) => {
                if (err) return safeReject(err);

                console.log(`Searching inbox for messages SINCE: ${searchDate}`);
                imap.search([['SINCE', searchDate]], (err, results) => {
                    if (err) return safeReject(err);
                    if (!results || results.length === 0) {
                        return safeResolve({
                            emailsScanned: 0,
                            xmlsFound: 0,
                            alreadyInDB: 0,
                            newSaved: 0,
                            message: 'No se encontraron correos'
                        });
                    }

                    emailsScanned = results.length;
                    console.log(`Found ${results.length} potential messages. Checking structures...`);
                    
                    const f = imap.fetch(results, { struct: true });
                    const partsToFetch: { uid: number, partID: string, encoding: string, filename: string, type: 'xml' | 'zip' }[] = [];
                    let processedStructs = 0;

                    f.on('message', (msg, seqno) => {
                        msg.once('attributes', (attrs) => {
                            const attachments = findAttachments(attrs.struct);
                            attachments.forEach(part => {
                                const filename = part.disposition?.params?.filename || part.params?.name || part.params?.filename;
                                if (!filename) return;
                                const ext = filename.split('.').pop().toLowerCase();
                                if (ext === 'xml' || ext === 'zip') {
                                    partsToFetch.push({
                                        uid: attrs.uid,
                                        partID: part.partID,
                                        encoding: part.encoding || 'base64',
                                        filename,
                                        type: ext as 'xml' | 'zip'
                                    });
                                }
                            });
                        });

                        msg.once('end', () => {
                            processedStructs++;
                        });
                    });

                    f.once('error', (err) => safeReject(err));
                    f.once('end', () => {
                        console.log(`Done structure scan. Found ${partsToFetch.length} attachment parts to fetch.`);
                        if (partsToFetch.length === 0) {
                            return safeResolve({
                                emailsScanned,
                                xmlsFound: 0,
                                alreadyInDB: 0,
                                newSaved: 0,
                                message: 'No se encontraron facturas XML en los correos nuevos'
                            });
                        }

                        // Fetch attachment parts sequentially
                        let index = 0;
                        const fetchNext = () => {
                            if (index >= partsToFetch.length) {
                                console.log('All attachment parts processed.');
                                return safeResolve({
                                    emailsScanned,
                                    xmlsFound: xmlsFoundCount,
                                    alreadyInDB: alreadyInDBCount,
                                    newSaved: newInvoicesCount,
                                    message: ''
                                });
                            }

                            const item = partsToFetch[index];
                            console.log(`Downloading attachment [${index + 1}/${partsToFetch.length}]: ${item.filename}`);
                            const f2 = imap.fetch(item.uid, { bodies: item.partID });

                            f2.on('message', (m) => {
                                m.on('body', (stream, info) => {
                                    let rawData = '';
                                    stream.on('data', (chunk) => {
                                        rawData += chunk.toString();
                                    });
                                    stream.on('end', async () => {
                                        try {
                                            let content: string | Buffer = rawData;
                                            if (item.encoding.toLowerCase() === 'base64') {
                                                content = Buffer.from(rawData, 'base64');
                                            }

                                            if (item.type === 'xml') {
                                                xmlsFoundCount++;
                                                const xmlString = content.toString('utf8');
                                                const result = await processXML(xmlString, item.filename);
                                                if (result === 'new') newInvoicesCount++;
                                                else if (result === 'exists') alreadyInDBCount++;
                                            } else if (item.type === 'zip') {
                                                try {
                                                    const AdmZip = require('adm-zip');
                                                    const zip = new AdmZip(content as Buffer);
                                                    const zipEntries = zip.getEntries();
                                                    for (const zipEntry of zipEntries) {
                                                        if (zipEntry.entryName.toLowerCase().endsWith('.xml')) {
                                                            xmlsFoundCount++;
                                                            const xmlContent = zipEntry.getData().toString('utf8');
                                                            const result = await processXML(xmlContent, zipEntry.entryName);
                                                            if (result === 'new') newInvoicesCount++;
                                                            else if (result === 'exists') alreadyInDBCount++;
                                                        }
                                                    }
                                                } catch (zerr) {
                                                    console.error('Failed to extract ZIP:', zerr);
                                                }
                                            }
                                        } catch (procErr) {
                                            console.error(`Error processing part for UID ${item.uid}:`, procErr);
                                        }
                                    });
                                });
                            });

                            f2.once('end', () => {
                                index++;
                                fetchNext();
                            });

                            f2.once('error', (err) => {
                                console.error(`Error fetching part for UID ${item.uid}:`, err);
                                index++;
                                fetchNext();
                            });
                        };

                        fetchNext();
                    });
                });
            });
        });

        imap.once('error', (err) => safeReject(err));
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

async function processXML(xmlContent: string, filename: string): Promise<'new' | 'exists' | null> {
    try {
        const jsonObj = xmlParser.parse(xmlContent);
        const comprobante = findNode(jsonObj, "Comprobante");
        if (!comprobante) return null;

        const timbre = findNode(findNode(comprobante, "Complemento"), "TimbreFiscalDigital");
        const uuid = getAttr(timbre, "UUID");

        if (!uuid) return null;

        // 1. QUICK CHECK: Does it already exist in DB?
        const { data: existing } = await supabase
            .from('facturas')
            .select('id')
            .eq('uuid_sat', uuid)
            .maybeSingle();

        if (existing) {
            return 'exists'; // Already in DB
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
            return null;
        } else {
            console.log('--- NEW INVOICE SAVED:', uuid, '---');
            return 'new';
        }
    } catch (e) {
        console.error('Error parsing XML:', e);
        return null;
    }
}
