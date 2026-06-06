export default function Terms() {
  return (
    <div className="frame max-w-2xl py-8">
      <div className="mb-6 rounded border border-amber-300 bg-amber-50 p-3 font-sans text-sm text-amber-800">
        ⚠️ Placeholder — replace with your actual terms before submitting to the App Store.
      </div>
      <h1 className="font-serif text-3xl font-bold text-ink">Terms of Use</h1>
      <p className="mt-2 font-sans text-sm text-muted">Last updated: [date]</p>

      <div className="mt-6 space-y-4 font-sans text-sm text-ink leading-relaxed">
        <p>
          By using <strong>Crack</strong>, you agree to these terms.
        </p>

        <h2 className="font-serif text-xl font-bold">Use of the app</h2>
        <p>
          Crack is provided for personal entertainment. Don&apos;t use it to submit harmful, illegal,
          or abusive content.
        </p>

        <h2 className="font-serif text-xl font-bold">Your content</h2>
        <p>
          Answers and display names you submit remain yours. By submitting them, you grant Crack
          permission to display them to other players in your game room.
        </p>

        <h2 className="font-serif text-xl font-bold">Disclaimer</h2>
        <p>
          Crack is provided &quot;as is&quot; without warranties of any kind. We&apos;re not liable for
          any damages arising from your use of the app.
        </p>

        <h2 className="font-serif text-xl font-bold">Contact</h2>
        <p>
          Questions? Email <a href="mailto:[your email]" className="underline">[your email]</a>.
        </p>
      </div>
    </div>
  );
}
