import Imap from 'node-imap';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const hosts = ['outlook.office365.com', 'imap-mail.outlook.com', 'imap.outlook.com'];

async function testHost(host: string) {
    return new Promise((resolve) => {
        console.log(`\n--- Testing Host: ${host} ---`);
        const imap = new (Imap as any)({
            user,
            password: pass,
            host,
            port: 993,
            tls: true,
            tlsOptions: { rejectUnauthorized: false, servername: host },
            authTimeout: 10000
        });

        imap.once('ready', () => {
            console.log(`✅ SUCCESS with ${host}`);
            imap.end();
            resolve(true);
        });

        imap.once('error', (err: any) => {
            console.log(`❌ FAILED with ${host}: ${err.message}`);
            resolve(false);
        });

        imap.connect();
    });
}

async function runAll() {
    for (const host of hosts) {
        const ok = await testHost(host);
        if (ok) break;
    }
}

runAll();
