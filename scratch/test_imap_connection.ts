import Imap from 'node-imap';
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

async function testConnection() {
    console.log('Testing connection to:', imapConfig.user);
    console.log('Host:', imapConfig.host);
    console.log('Port:', imapConfig.port);
    
    if (!imapConfig.user || !imapConfig.password || !imapConfig.host) {
        console.error('Missing email configuration in .env.local');
        return;
    }

    const imap = new (Imap as any)({
        ...imapConfig,
        debug: (cmd: string) => console.log('IMAP DEBUG:', cmd)
    });

    imap.once('ready', () => {
        console.log('Successfully connected to IMAP!');
        imap.openBox('INBOX', true, (err: any, box: any) => {
            if (err) console.error('Error opening box:', err);
            else console.log(`INBOX has ${box.messages.total} messages.`);
            imap.end();
        });
    });

    imap.once('error', (err: any) => {
        console.error('IMAP Error:', err);
    });

    imap.once('end', () => {
        console.log('Connection ended.');
    });

    imap.connect();
}

testConnection();
