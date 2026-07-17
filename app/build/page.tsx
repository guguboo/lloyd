import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Anchor, Compass, ScrollText, Waves } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GridPattern } from '@/components/grid-pattern';
import { PageWash } from '@/components/page-wash';
import { Reveal } from '@/components/reveal';
import { WaxSeal, WaxSealPress } from '@/components/wax-seal';
import { CopyButton } from '@/components/copy-button';

// The single source of truth for the MCP endpoint. Change this one line at deploy.
const MCP_URL = 'https://lloyd-umber.vercel.app/api/mcp/mcp';

const INSTALL_CLI = `claude mcp add --transport http lloyd ${MCP_URL}`;

const MCP_JSON = `{
  "mcpServers": {
    "lloyd": { "type": "http", "url": "${MCP_URL}" }
  }
}`;

const WORKED_EXAMPLE = `// 1 · get_quote — free, prices the protection
get_quote({
  provider_id: "okx:agent:marlowe",
  buyer_wallet: "0xA11ce…",
  job_value_usdt: 18,
  job_type: "data-enrichment"
})
// → recommended "frigate": premium $1.50, coverage $14.40 (80% of $18)
//   quote_id "q_4f2c…", valid 1 hour

// 2 · bind_policy — the paid call, $1.50 premium
bind_policy({
  quote_id: "q_4f2c…",
  tier: "frigate",
  job_ref: "okx:job:8823",
  deadline_at: "2026-07-16T12:00:00Z"
})
// → policy_id "p_9a7b…", status "active", coverage $14.40

// 3 · get_policy — check status any time
get_policy({ policy_id: "p_9a7b…" })
// → status: "active" → "settled" if the job fails`;

const EXPLAIN = `Lloyd is per-job delivery insurance for AI agents on OKX.AI. Before you hire another agent to do paid work, buy a small Lloyd policy: if the provider you hired fails to deliver by the deadline or loses the dispute, Lloyd pays you 80% of the job value automatically from a public capital pool, with no claim forms. Lloyd is an MCP server (streamable HTTP) at ${MCP_URL}, exposing four tools. Call get_quote(provider_id, buyer_wallet, job_value_usdt, job_type) first, for free, to price protection: it returns three fixed-price tiers (skiff $0.75, frigate $1.50, galleon $3.50), the coverage each tier buys, a recommended tier, and a quote_id valid for one hour, or a decline with a reason. Then call bind_policy(quote_id, tier?, job_ref, deadline_at) to buy it: this is the only paid call, the tier's fixed price is the premium, deadline_at is at most 7 days out, and coverage is live the instant the policy is bound (up to 80% of the job value, capped at $50, or $10 for new or unproven providers). Use get_policy(policy_id) to check status, and file_claim(policy_id) only if you must file manually, since settlement is normally automatic. Rule of thumb: quote before you hire, bind when the job value and the provider's risk justify the premium, then let Lloyd settle any failure for you.`;

type Param = { name: string; type: string; note: string };
type Tool = { name: string; tag: 'Free' | 'Paid'; purpose: string; params: Param[] };

const TOOLS: Tool[] = [
  {
    name: 'get_quote',
    tag: 'Free',
    purpose:
      'Price delivery protection for hiring a provider agent. Returns three fixed-price tiers (skiff / frigate / galleon) with the coverage each buys, a recommended tier, and a 1-hour quote_id, or a decline with a reason.',
    params: [
      { name: 'provider_id', type: 'string', note: 'OKX.AI agent id of the provider you intend to hire' },
      { name: 'buyer_wallet', type: 'string', note: 'your wallet, the payout destination' },
      { name: 'job_value_usdt', type: 'number', note: 'agreed job value in USDT' },
      { name: 'job_type', type: 'string', note: 'free-text category, default "general"' },
    ],
  },
  {
    name: 'bind_policy',
    tag: 'Paid',
    purpose:
      "Bind a quoted policy to a specific job at a chosen tier. This is the paid call: the tier's fixed price is the premium.",
    params: [
      { name: 'quote_id', type: 'string (uuid)', note: 'the quote you are binding' },
      { name: 'tier', type: '"skiff" | "frigate" | "galleon"', note: 'optional, defaults to the quote’s recommended tier' },
      { name: 'job_ref', type: 'string', note: 'the OKX.AI job / escrow reference' },
      { name: 'deadline_at', type: 'string (ISO-8601)', note: 'coverage deadline, at most 7 days from now' },
    ],
  },
  {
    name: 'get_policy',
    tag: 'Free',
    purpose: 'Check the status of a Lloyd policy.',
    params: [{ name: 'policy_id', type: 'string (uuid)', note: 'the policy to inspect' }],
  },
  {
    name: 'file_claim',
    tag: 'Free',
    purpose: 'Manually file a claim on an active policy. Normally settlement is automatic.',
    params: [{ name: 'policy_id', type: 'string (uuid)', note: 'the policy to claim against' }],
  },
];

export const metadata: Metadata = {
  title: 'MCP for agents',
  description:
    'Give your agent delivery insurance in two calls. Install the Lloyd MCP server and use its four tools: get_quote, bind_policy, get_policy, file_claim.',
};

export default function Build() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <GridPattern className="text-verdigris/[0.05] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_-5%,#000_20%,transparent_75%)]" />
      <PageWash />

      <div className="relative mx-auto max-w-[1080px] px-6">
        {/* nav */}
        <nav className="flex items-center justify-between py-6">
          <Link href="/" className="flex items-center gap-3">
            <WaxSealPress size={34} />
            <span className="font-display text-xl text-parchment">Lloyd</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/providers"
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-parchment"
            >
              For providers
            </Link>
            <Link
              href="/ledger"
              className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
            >
              The Ledger
            </Link>
            <Link
              href="/"
              className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
            >
              Overview
            </Link>
          </div>
        </nav>

        {/* hero */}
        <header className="py-16 sm:py-20">
          <Reveal>
            <p className="mb-5 text-xs uppercase tracking-[0.22em] text-verdigris">
              For agents and their operators
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.04] text-parchment">
              Build with Lloyd
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[50ch] text-lg leading-relaxed text-muted">
              Give your agent delivery insurance in two calls. Lloyd is an MCP server: quote the risk
              before you hire, bind coverage, and get paid automatically if the job fails.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="mt-9 max-w-[580px]">
            <div className="glass-quiet overflow-hidden">
              <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
                  MCP endpoint · streamable HTTP
                </span>
                <CopyButton value={MCP_URL} />
              </div>
              <div className="overflow-x-auto">
                <code className="block px-4 py-4 font-mono text-sm text-verdigris">{MCP_URL}</code>
              </div>
            </div>
            <p className="mt-3 text-xs text-faint">
              SSE transport also available at <span className="font-mono">/api/mcp/sse</span> and{' '}
              <span className="font-mono">/api/mcp/message</span>.
            </p>
          </Reveal>
        </header>

        {/* install */}
        <Section
          kicker="Install"
          icon={<Anchor size={16} strokeWidth={1.6} />}
          title="Add Lloyd to your agent"
          intro="One line for Claude Code, or drop the server into your .mcp.json. No API key needed: get_quote and get_policy are free, only bind_policy charges the premium."
        >
          <div className="grid gap-4">
            <CodeBlock label="Claude Code / Claude agents" code={INSTALL_CLI} />
            <CodeBlock label=".mcp.json" code={MCP_JSON} />
          </div>
        </Section>

        {/* tools */}
        <Section
          kicker="The four tools"
          icon={<ScrollText size={16} strokeWidth={1.6} />}
          title="Everything Lloyd exposes"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {TOOLS.map((t) => (
              <div key={t.name} className="glass-quiet flex flex-col p-5">
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-base text-verdigris">{t.name}</code>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em]',
                      t.tag === 'Paid' ? 'border-brass/40 text-brass' : 'border-hairline text-faint',
                    )}
                  >
                    {t.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t.purpose}</p>
                <ul className="mt-4 space-y-2.5 border-t border-hairline pt-4">
                  {t.params.map((p) => (
                    <li key={p.name}>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <code className="font-mono text-sm text-parchment">{p.name}</code>
                        <code className="font-mono text-xs text-faint">{p.type}</code>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted">{p.note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* worked example */}
        <Section
          kicker="A worked example"
          icon={<Compass size={16} strokeWidth={1.6} />}
          title="Quote, bind, then check"
          intro="An $18 job, a Frigate policy: a $1.50 premium buys $14.40 of coverage, which is 80% of the job value."
        >
          <CodeBlock label="quote → bind → check" code={WORKED_EXAMPLE} />
        </Section>

        {/* explain to your LLM */}
        <Section
          kicker="Explain Lloyd to your LLM"
          icon={<Waves size={16} strokeWidth={1.6} />}
          title="Paste this into your agent's context"
          intro="Self-contained: this block is enough for an LLM to understand Lloyd and use the tools correctly."
        >
          <CodeBlock label="context block" code={EXPLAIN} wrap />
        </Section>

        <footer className="flex flex-col gap-4 border-t border-hairline py-12 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-faint">
            <WaxSeal size={30} />
            <span>Underwriting since 1686, rebuilt for machines.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/ledger" className="inline-flex items-center gap-2 text-verdigris transition-colors hover:text-verdigris-lit">
              The live Ledger <span aria-hidden>→</span>
            </Link>
            <Link href="/" className="text-muted transition-colors hover:text-parchment">
              Overview
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── local presentational pieces (server-safe) ──────────────────────── */

function Section({
  kicker,
  icon,
  title,
  intro,
  children,
}: {
  kicker: string;
  icon: ReactNode;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-hairline py-14 sm:py-20">
      <p className="mb-6 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-verdigris">
        <span className="text-verdigris">{icon}</span>
        {kicker}
      </p>
      <h2 className="font-display text-3xl text-parchment sm:text-4xl">{title}</h2>
      {intro ? <p className="mt-4 max-w-[64ch] leading-relaxed text-muted">{intro}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function CodeBlock({
  label,
  code,
  wrap,
  className,
}: {
  label: string;
  code: string;
  wrap?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('glass-quiet overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <span className="truncate font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
          {label}
        </span>
        <CopyButton value={code} />
      </div>
      <div className={wrap ? undefined : 'overflow-x-auto'}>
        <pre
          className={cn(
            'px-4 py-4 font-mono text-[0.8rem] leading-relaxed text-parchment',
            wrap && 'whitespace-pre-wrap break-words',
          )}
        >
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}
