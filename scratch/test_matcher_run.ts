import { matchInvoicesWithMovements } from './src/lib/invoiceMatcher';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    console.log('Running matcher...');
    const result = await matchInvoicesWithMovements();
    console.log('Match Result:', result);
}
run();
