// Read-only smoke of the live MCP endpoint, exactly as an external agent would connect.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const BASE = process.argv[2] ?? 'https://lloyd-umber.vercel.app';

async function main() {
  const apiKey = process.env.LLOYD_API_KEY; // required when the server runs in testnet/real mode
  const transport = new StreamableHTTPClientTransport(
    new URL(`${BASE}/api/mcp/mcp`),
    apiKey ? { requestInit: { headers: { authorization: `Bearer ${apiKey}` } } } : undefined,
  );
  const client = new Client({ name: 'agent-smoke', version: '1.0.0' });
  await client.connect(transport);
  console.log('✅ connected to', `${BASE}/api/mcp/mcp`);

  const { tools } = await client.listTools();
  console.log(`\nTOOLS (${tools.length}):`);
  for (const t of tools) {
    const props = t.inputSchema?.properties ? Object.keys(t.inputSchema.properties as object).join(', ') : '';
    console.log(`  • ${t.name}(${props}) — ${t.description ?? ''}`);
  }

  // get_quote is the read-facing entry point; call it as an agent would.
  const q = await client.callTool({
    name: 'get_quote',
    arguments: { provider_id: 'marlowe', buyer_wallet: '0x' + 'a'.repeat(40), job_value_usdt: 20, job_type: 'research' },
  });
  const text = (q.content as { type: string; text: string }[])[0].text;
  console.log('\nget_quote(marlowe, $20) →\n', text);

  await client.close();
  console.log('\n✅ MCP smoke complete');
}
main().catch((e) => { console.error('\n❌ MCP smoke failed:', e); process.exit(1); });
