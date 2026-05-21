import { syncInvoicesFromEmail } from './src/lib/emailProcessor';
import { matchInvoicesWithMovements } from './src/lib/invoiceMatcher';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testFullSync() {
    console.log('--- Starting Sync ---');
    const syncRes = await syncInvoicesFromEmail();
    console.log('Sync Result:', syncRes);

    console.log('--- Starting Matcher ---');
    const matchRes = await matchInvoicesWithMovements();
    console.log('Match Result:', matchRes);
}

testFullSync();
