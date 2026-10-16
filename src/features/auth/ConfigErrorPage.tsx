// Shown instead of the app when the build has no usable Supabase settings. Kept free of
// any import that would create the Supabase client.
export function ConfigErrorPage({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-extrabold">The app is not connected to the City's database</h1>
      <p role="alert" className="mt-4 rounded-control border-l-4 border-bad bg-bad-soft px-4 py-3 font-semibold">{message}</p>
      <p className="mt-4 text-muted">
        For the person who publishes the app: set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in the
        hosting settings (Netlify: Site configuration, Environment variables), then deploy again. DEPLOY.md, section 6, has the steps.
      </p>
    </main>
  );
}
