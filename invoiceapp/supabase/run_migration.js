// One-time setup script — run with: node supabase/run_migration.js <management-token>
// Get your management token at: https://supabase.com/dashboard/account/tokens
const https = require('https');
const fs = require('fs');

const token = process.argv[2];
const projectRef = 'jycsitanxkksucttkrdp';
const sql = fs.readFileSync(__dirname + '/migrations/20260517_initial_schema.sql', 'utf8');

if (!token) {
  console.error('Usage: node supabase/run_migration.js <management-token>');
  console.error('Get token at: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const body = JSON.stringify({ query: sql });
const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('Migration applied successfully!');
    } else {
      console.error(`HTTP ${res.statusCode}:`, data);
    }
  });
});
req.on('error', err => console.error('Error:', err.message));
req.write(body);
req.end();
