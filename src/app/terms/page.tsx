import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — Mega 99",
  description: "Terms and Conditions governing the use of the Mega 99 platform.",
};

// Static legal page — server-rendered, no client JS required.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-black text-white md:text-2xl">
          Terms &amp; Conditions
        </h1>
        <Link href="/register" className="text-xs font-semibold text-white/85">
          ← Back
        </Link>
      </div>

      <div className="card space-y-6 p-5 text-sm leading-relaxed text-slate-300 md:p-7">
        <p className="text-xs text-slate-500">Last updated: 7 July 2026</p>

        <p>
          These Terms &amp; Conditions (the &ldquo;Terms&rdquo;) govern your access to and use
          of the Mega 99 platform, website and related services (collectively, the
          &ldquo;Platform&rdquo;). By registering an account, depositing funds or placing a
          bet you confirm that you have read, understood and agree to be bound by these
          Terms in full. If you do not agree, do not use the Platform.
        </p>

        <Section n="1" title="Eligibility">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must be at least 18 years old, or the legal gambling age in your jurisdiction, whichever is higher.</li>
            <li>You must not access the Platform from any jurisdiction where online gaming is prohibited. You are solely responsible for verifying that your use of the Platform is lawful where you live.</li>
            <li>Employees, contractors and their immediate family members are not permitted to play with real funds.</li>
            <li>We may request proof of age and identity at any time and may suspend an account until satisfactory proof is provided.</li>
          </ul>
        </Section>

        <Section n="2" title="Account Rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>You may hold only one account. Duplicate accounts may be closed and their balances voided.</li>
            <li>Account credentials are personal. You are responsible for all activity under your account and for keeping your password secure.</li>
            <li>Account details you provide must be accurate, current and complete. Impersonation or false information is grounds for immediate termination.</li>
            <li>Accounts are not transferable, sellable or shareable.</li>
          </ul>
        </Section>

        <Section n="3" title="Deposits">
          <ul className="list-disc space-y-1 pl-5">
            <li>Deposits are made in USDT (TRC20) to the deposit address assigned to your account. Sending any other token or using any other network may result in permanent loss of funds.</li>
            <li>Deposits are credited after network confirmation, or after manual review for transfers that cannot be verified on-chain.</li>
            <li>Minimum deposit amounts are displayed on the deposit page and may change from time to time.</li>
            <li>Funds deposited must be used for genuine play. We may refuse or reverse deposits associated with suspicious activity.</li>
            <li>You must be the rightful owner of the funds you deposit.</li>
          </ul>
        </Section>

        <Section n="4" title="Withdrawals">
          <ul className="list-disc space-y-1 pl-5">
            <li>Withdrawals are paid in USDT (TRC20) to the address you provide. Double-check the address — transfers to a wrong address cannot be recovered.</li>
            <li>Withdrawal requests are subject to verification, minimum amounts, daily limits, anti-abuse eligibility checks and a processing fee, each shown or communicated at the time of request.</li>
            <li>To prevent fraud and money laundering, we may require betting turnover before a withdrawal is released, and may request source-of-funds information.</li>
            <li>We aim to process withdrawals promptly; processing times may vary during verification or high volume.</li>
            <li>We may pay large withdrawals in instalments.</li>
          </ul>
        </Section>

        <Section n="5" title="Bonuses & Rewards">
          <ul className="list-disc space-y-1 pl-5">
            <li>Bonuses, referral rewards, VIP benefits and promotions are discretionary and subject to their own published conditions, including qualification rules and holding periods.</li>
            <li>Referral rewards are earned only when a referred user completes a qualifying approved deposit.</li>
            <li>Abuse of any promotion — including self-referral, multi-accounting or collusion — voids the associated rewards and may lead to account closure.</li>
            <li>We may amend or withdraw any promotion at any time; changes do not affect rewards already credited.</li>
          </ul>
        </Section>

        <Section n="6" title="Responsible Gaming">
          <ul className="list-disc space-y-1 pl-5">
            <li>Gambling should be entertainment, not a source of income. Never bet more than you can afford to lose.</li>
            <li>If you wish to take a break, contact support to suspend or permanently close your account.</li>
            <li>If you believe you may have a gambling problem, we encourage you to seek help from a recognised support organisation such as GamCare (gamcare.org.uk) or Gamblers Anonymous (gamblersanonymous.org).</li>
            <li>We reserve the right to close accounts where we believe continued play is harmful.</li>
          </ul>
        </Section>

        <Section n="7" title="Fraud Prevention">
          <ul className="list-disc space-y-1 pl-5">
            <li>We monitor gameplay and transactions for fraud, collusion, bonus abuse, use of automated agents (bots) and exploitation of software errors.</li>
            <li>Any form of cheating, game manipulation or exploit abuse results in the voiding of affected bets and winnings and may result in permanent closure.</li>
            <li>We may withhold funds connected to fraudulent activity and report such activity to relevant authorities.</li>
          </ul>
        </Section>

        <Section n="8" title="Anti-Money Laundering (AML)">
          <ul className="list-disc space-y-1 pl-5">
            <li>We apply anti-money-laundering controls including transaction monitoring, deposit/withdrawal limits and turnover requirements.</li>
            <li>Deposited funds must be wagered genuinely before withdrawal; deposits followed by immediate withdrawal attempts may be rejected and investigated.</li>
            <li>We may suspend accounts and freeze balances while an AML investigation is ongoing and may report suspicious activity to the competent authorities without notice to you.</li>
          </ul>
        </Section>

        <Section n="9" title="Know Your Customer (KYC)">
          <ul className="list-disc space-y-1 pl-5">
            <li>We may require identity verification documents (such as government ID and proof of address) before processing deposits, withdrawals or continued play.</li>
            <li>Failure to complete KYC when requested may result in suspension of the account and withholding of withdrawals until verification completes.</li>
            <li>Documents are handled confidentially and used solely for verification and compliance purposes.</li>
          </ul>
        </Section>

        <Section n="10" title="Termination">
          <ul className="list-disc space-y-1 pl-5">
            <li>You may close your account at any time by contacting support. Verified remaining balances are returned subject to these Terms.</li>
            <li>We may suspend or terminate an account immediately where these Terms are breached, where required by law, or where fraud, abuse or AML concerns exist.</li>
            <li>On termination for breach, winnings obtained through the breach may be voided.</li>
          </ul>
        </Section>

        <Section n="11" title="Privacy">
          <ul className="list-disc space-y-1 pl-5">
            <li>We collect and process personal data (account details, transaction history, gameplay and technical data) to operate the Platform, meet legal obligations and prevent fraud.</li>
            <li>We do not sell your personal data. Data is shared only with service providers necessary to operate the Platform or where required by law.</li>
            <li>You may request a copy of, or the deletion of, your personal data by contacting support, subject to legal retention requirements.</li>
          </ul>
        </Section>

        <Section n="12" title="Limitation of Liability">
          <ul className="list-disc space-y-1 pl-5">
            <li>The Platform is provided &ldquo;as is&rdquo;. We do not warrant uninterrupted or error-free operation.</li>
            <li>In the event of a software or system error, affected bets are void and stakes returned; obvious mispriced or erroneous results may be corrected.</li>
            <li>To the maximum extent permitted by law, our total liability to you shall not exceed the amount held in your account balance at the time the claim arises.</li>
            <li>We are not liable for losses caused by blockchain network failures, third-party wallets or exchanges, or events beyond our reasonable control.</li>
          </ul>
        </Section>

        <Section n="13" title="Disputes">
          <ul className="list-disc space-y-1 pl-5">
            <li>Contact support first — most issues are resolved quickly. Disputes must be raised within 30 days of the event giving rise to them.</li>
            <li>Our records (server logs, transaction ledger and provably-fair round data) are the authoritative record of play.</li>
            <li>Unresolved disputes are subject to final internal review by platform management.</li>
          </ul>
        </Section>

        <Section n="14" title="Changes to These Terms">
          <ul className="list-disc space-y-1 pl-5">
            <li>We may update these Terms from time to time. The &ldquo;Last updated&rdquo; date above reflects the current version.</li>
            <li>Material changes will be announced on the Platform. Continued use after a change constitutes acceptance of the updated Terms.</li>
          </ul>
        </Section>

        <p className="border-t border-black/10 pt-4 text-xs text-slate-500">
          By creating an account you acknowledge that you have read, understood and
          agreed to these Terms &amp; Conditions in their entirety.
        </p>
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-[#111111]">
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
