import { NextRequest, NextResponse } from 'next/server';
import { syncInvoicesFromEmail } from '@/lib/emailProcessor';
import { matchInvoicesWithMovements } from '@/lib/invoiceMatcher';

export async function POST(req: NextRequest) {
    try {
        // 1. Sync from email
        const syncResult = await syncInvoicesFromEmail();
        
        // 2. Run matching engine on ALL pending/suggested invoices (not just new ones)
        const matchResult = await matchInvoicesWithMovements();

        return NextResponse.json({ 
            success: true, 
            sync: syncResult,
            matches: matchResult 
        });

    } catch (error: any) {
        console.error('Invoice Sync Error Details:', {
            message: error.message,
            stack: error.stack,
            cause: error.cause
        });
        return NextResponse.json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
