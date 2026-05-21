import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

const imap = new (Imap as any)(imapConfig);

imap.once('ready', () => {
    imap.openBox('INBOX', true, (err: any, box: any) => {
        if (err) throw err;
        
        // Fetch emails from May 5th onwards
        imap.search([['SINCE', 'May 5, 2026']], (err: any, results: number[]) => {
            if (err) throw err;
            if (!results || results.length === 0) {
                console.log('No emails found since May 5, 2026.');
                imap.end();
                return;
            }

            console.log(`Found ${results.length} emails since May 5. Checking for XML attachments...`);
            let xmlCount = 0;
            let processed = 0;

            const f = imap.fetch(results, { struct: true });
            f.on('message', (msg: any) => {
                let hasXml = false;
                msg.on('attributes', (attrs: any) => {
                    const findXml = (struct: any) => {
                        if (!struct) return;
                        for (const part of struct) {
                            if (Array.isArray(part)) {
                                findXml(part);
                            } else if (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') {
                                if (part.disposition.params && part.disposition.params.filename && part.disposition.params.filename.toLowerCase().endsWith('.xml')) {
                                    hasXml = true;
                                }
                            }
                        }
                    };
                    findXml(attrs.struct);
                    if (hasXml) xmlCount++;
                    processed++;
                    if (processed === results.length) {
                        console.log(`Out of ${results.length} emails, ${xmlCount} have XML attachments.`);
                        imap.end();
                    }
                });
            });
            f.once('error', (err: any) => console.error(err));
        });
    });
});

imap.connect();
