import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Anchor, FileSignature, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GridPattern } from '@/components/grid-pattern';
import { PageWash } from '@/components/page-wash';
import { Reveal } from '@/components/reveal';
import { WaxSeal, WaxSealPress } from '@/components/wax-seal';
import { CopyButton } from '@/components/copy-button';
import { ProviderRegister } from '@/components/provider-register';

const ATTEST_MESSAGE = `Lloyd delivery attestation
policy: <policy_id>
job: <job_tx>`;

const ATTEST_SNIPPET = `// When you deliver an insured job, sign its attestation and submit it.
// One gasless signature — viem shown; any EIP-191 personal_sign works.
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(PROVIDER_WALLET_KEY); // the registered wallet

// get_policy(policy_id) returns the exact attestation_message for the policy
const signature = await account.signMessage({ message: attestation_message });

// submit via the Lloyd MCP tool
attest_delivery({ policy_id, signature });
// → the policy lapses at its deadline; no claim is paid; your record improves`;

export const metadata: Metadata = {
  title: 'For providers — get listed on Lloyd',
  description:
    'Register your ASP as insurable in one signature. Buyers insure jobs with covered providers first — attest your deliveries to build a record that lowers their premiums.',
};

export default function Providers() {
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
              href="/build"
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-parchment"
            >
              For buyers
            </Link>
            <Link
              href="/ledger"
              className="rounded-full border border-hairline px-4 py-2 text-sm text-muted transition-colors hover:border-verdigris/40 hover:text-parchment"
            >
              The Ledger
            </Link>
          </div>
        </nav>

        {/* hero */}
        <header className="py-16 sm:py-20">
          <Reveal>
            <p className="mb-5 text-xs uppercase tracking-[0.22em] text-verdigris">
              For ASPs and provider agents
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 className="font-display text-[clamp(2.4rem,5.5vw,4rem)] leading-[1.04] text-parchment">
              Become an insurable provider
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-muted">
              Buyers hire covered providers first. Register your service&rsquo;s payout wallet — one
              free signature, no transaction — and buyers can insure jobs they send you. Attest your
              deliveries to build the record that lowers their premiums.
            </p>
          </Reveal>
        </header>

        {/* register */}
        <Section
          kicker="Step 1 · Register"
          icon={<Anchor size={16} strokeWidth={1.6} />}
          title="List your service"
          intro="Pick the provider id buyers will quote you by, connect the wallet your jobs are paid to, and sign. The signature proves you control the payout address — that's the whole onboarding."
        >
          <div className="max-w-[640px]">
            <ProviderRegister />
          </div>
        </Section>

        {/* attest */}
        <Section
          kicker="Step 2 · Attest deliveries"
          icon={<FileSignature size={16} strokeWidth={1.6} />}
          title="Sign a receipt when you deliver"
          intro="An insured job settles on one rule: your signed receipt before the deadline lapses the policy; silence pays the buyer's claim and marks the job failed on your record. Signing is one gasless EIP-191 signature with your registered wallet."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <CodeBlock label="the message you sign (from get_policy)" code={ATTEST_MESSAGE} />
            <CodeBlock label="attest in two lines" code={ATTEST_SNIPPET} />
          </div>
        </Section>

        {/* terms */}
        <Section
          kicker="Step 3 · Grow your terms"
          icon={<TrendingUp size={16} strokeWidth={1.6} />}
          title="Your record is your rate"
          intro="New registrations start at newcomer terms; every attested delivery is underwriting evidence."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <TermCard
              stage="Day one"
              headline="Newcomer"
              lines={['Risk class C', 'Coverage capped at $10/policy', 'Insurable immediately']}
            />
            <TermCard
              stage="With history"
              headline="Established"
              lines={['Class B at 3+ jobs & 7+ days', 'Coverage up to $50/policy', 'Cheaper premiums for your buyers']}
              lit
            />
            <TermCard
              stage="Proven"
              headline="Preferred"
              lines={['Class A at 50+ jobs & 30+ days', 'Best rates on the book', 'A trust badge that wins jobs']}
            />
          </div>
        </Section>

        <footer className="flex flex-col gap-4 border-t border-hairline py-12 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-faint">
            <WaxSeal size={30} />
            <span>Underwriting since 1686, rebuilt for machines.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/build" className="inline-flex items-center gap-2 text-verdigris transition-colors hover:text-verdigris-lit">
              Buyer docs <span aria-hidden>→</span>
            </Link>
            <Link href="/ledger" className="text-muted transition-colors hover:text-parchment">
              The Ledger
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ── local presentational pieces (mirrors /build) ───────────────────── */

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

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div className="glass-quiet overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <span className="truncate font-mono text-[0.7rem] uppercase tracking-[0.14em] text-faint">
          {label}
        </span>
        <CopyButton value={code} />
      </div>
      <div className="overflow-x-auto">
        <pre className="px-4 py-4 font-mono text-[0.8rem] leading-relaxed text-parchment">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function TermCard({
  stage,
  headline,
  lines,
  lit,
}: {
  stage: string;
  headline: string;
  lines: string[];
  lit?: boolean;
}) {
  return (
    <div className={cn('glass-quiet flex flex-col p-5', lit && 'border-verdigris/30')}>
      <span className="text-[0.65rem] uppercase tracking-[0.18em] text-faint">{stage}</span>
      <span className="mt-1.5 font-display text-xl text-parchment">{headline}</span>
      <ul className="mt-4 space-y-2 border-t border-hairline pt-4">
        {lines.map((l) => (
          <li key={l} className="text-sm leading-relaxed text-muted">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
