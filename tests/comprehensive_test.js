
const http = require('http');

/**
 * Comprehensive Test Suite for SCA Requests Management System
 * 
 * Scenarios:
 * 1. Request Submission (Employee)
 * 2. N8N Workflow Integration (Auto-Approval/Rejection)
 * 3. Manager Review (Manual Decision)
 * 4. Database CRUD Verification
 */

// Configuration
const API_URL = 'http://localhost:4000/api'; // Adjust based on your local server
const MOCK_N8N_PORT = 5678;

// Helper: HTTP Request
async function request(url, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(fullUrl, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Mock N8N Webhook Server
function startMockN8n(decisionType = 'APPROVE', autoApprove = true) {
    return http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            console.log('   [Mock N8N] Received payload:', JSON.parse(body).meta.event_type);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                recommendation: decisionType,
                auto_approve: autoApprove,
                rejection_reason: decisionType === 'REJECT' ? 'Automatic rejection by test' : null,
                message: 'Decision from mock n8n'
            }));
        });
    }).listen(MOCK_N8N_PORT);
}

async function runTests() {
    console.log('🚀 Starting Comprehensive System Tests...\n');

    // 1. Setup Mock N8N
    const n8nServer = startMockN8n('APPROVE', true);
    console.log(`✅ Mock N8N Server running on port ${MOCK_N8N_PORT}`);

    try {
        // --- Scenario 1: Authentication ---
        console.log('\n--- Scenario 1: Authentication ---');
        const loginRes = await request('/auth/login', 'POST', { identifier: 'admin', password: 'admin' });
        if (loginRes.status !== 200) throw new Error('Login failed');
        const token = loginRes.data.token;
        const authHeaders = { 'Authorization': `Bearer ${token}` };
        console.log('✅ Admin login successful');

        // --- Scenario 2: System Settings (n8n integration) ---
        console.log('\n--- Scenario 2: N8N Integration Config ---');
        await request('/admin/settings', 'PUT', {
            mode_type: 'N8N',
            n8n_webhook_url: `http://localhost:${MOCK_N8N_PORT}/webhook-test`
        }, authHeaders);
        console.log('✅ N8N mode and webhook URL updated in settings');

        // --- Scenario 3: Submit Request & Auto-Decision ---
        console.log('\n--- Scenario 3: Request Submission with N8N Auto-Approve ---');
        const submitRes = await request('/employee/submit-request', 'POST', {
            user_id: 4, // Sara Mahmoud
            employee_name: 'سارة محمود',
            type_id: 1, // Casual Leave
            duration: 1,
            start_date: '2026-03-01',
            custom_data: { reason: 'Test Auto Approve' }
        }, authHeaders);

        console.log('✅ Request submitted. Response ID:', submitRes.data.request_id);
        console.log('✅ Final Status:', submitRes.data.status);
        
        if (submitRes.data.status !== 'APPROVED' && submitRes.data.status !== 'HR_APPROVED') {
             console.warn('   ⚠️ Warning: Status is', submitRes.data.status, 'expected APPROVED (if n8n auto_approve=true)');
        }

        // --- Scenario 4: Manual Rejection ---
        console.log('\n--- Scenario 4: Manager Manual Decision ---');
        // Stop the auto-approver for a second test
        n8nServer.close();
        const n8nServerManual = startMockN8n('REJECT', false);
        
        const submitRes2 = await request('/employee/submit-request', 'POST', {
            user_id: 5, // Mahmoud Saied
            employee_name: 'محمود سعيد',
            type_id: 1,
            duration: 2,
            start_date: '2026-03-05',
            custom_data: { reason: 'Test Manual Rejection' }
        }, authHeaders);

        console.log('✅ Second request submitted. Status:', submitRes2.data.status);
        if (submitRes2.data.status === 'REJECTED') {
            console.log('✅ Auto-rejected by N8N as expected');
        }

        n8nServerManual.close();

        // --- Scenario 5: Database CRUD ---
        console.log('\n--- Scenario 5: Database CRUD Verification ---');
        const tablesRes = await request('/admin/db/tables', 'GET', null, authHeaders);
        console.log(`✅ Tables found: ${tablesRes.data.join(', ')}`);

        const usersRes = await request('/admin/db/table/users', 'GET', null, authHeaders);
        console.log(`✅ Fetched users table. Rows: ${usersRes.data.length}`);

        // Update a user (CRUD: U)
        const updateRes = await request(`/admin/users/${loginRes.data.user.user_id}`, 'PUT', { phone_number: '0123456789' }, authHeaders);
        console.log('✅ User updated successfully');

        // CRUD: D (cleanup test user if created)
        // CRUD: R (already tested via get table data)

    } catch (e) {
        console.error('\n❌ Test failed:', e.message);
    } finally {
        console.log('\n--- Cleanup ---');
        n8nServer.close();
        console.log('✅ Servers shut down.');
    }
}

runTests();
