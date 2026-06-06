export default function Privacy() {
  return (
    <div className="frame max-w-2xl py-8">
      <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-3 font-sans text-sm text-amber-800">
        ⚠️ Placeholder — replace with your actual privacy policy before submitting to the App Store.
      </div>
      <h1 className="font-serif text-3xl font-bold text-ink">Privacy Policy</h1>
      <p className="mt-2 font-sans text-sm text-muted">Last updated: [date]</p>

      <div className="mt-6 space-y-4 font-sans text-sm text-ink leading-relaxed">
        <p>
          <strong>Crack</strong> is a name-initials word game. This policy explains what information we
          collect and how we use it.
        </p>

        <h2 className="font-serif text-xl font-bold">Information we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>A display name you choose when playing (not linked to your real identity).</li>
          <li>An anonymous account identifier created when you first play.</li>
          <li>Gameplay data: answers you submit, votes you cast, and scores.</li>
          <li>Usage analytics via Vercel Analytics (page views, performance metrics — no personal identifiers).</li>
        </ul>

        <h2 className="font-serif text-xl font-bold">How we use it</h2>
        <p>
          To run the game. We don&apos;t sell your data, share it with advertisers, or use it for any
          purpose other than operating Crack.
        </p>

        <h2 className="font-serif text-xl font-bold">Deleting your data</h2>
        <p>
          You can delete your account and all associated data at any time from the app menu (Menu →
          Delete account). Deletion is permanent and immediate.
        </p>

        <h2 className="font-serif text-xl font-bold">Contact</h2>
        <p>
          Questions? Email <a href="mailto:[your email]" className="underline">[your email]</a>.
        </p>
      </div>
    </div>
  );
}
