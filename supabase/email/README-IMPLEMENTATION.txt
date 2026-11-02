ORMOC DRRM OPERATIONS — SUPABASE AUTH EMAIL TEMPLATES

Included templates:
01 Confirm email address
02 Invite user
03 Magic link
04 Change email address
05 Reset password
06 Reauthentication

Brand palette: navy #0F4C81, action green #1F6F43, paper #F4F7F9,
ink #1F2937, body #4B5563. Typography follows the platform intent:
Montserrat headings, Poppins body, Roboto Condensed labels/numeric code,
with email-safe system fallbacks.

Supabase template variables:
- Confirm email: {{ .ConfirmationURL }}
- Invite user: {{ .ConfirmationURL }}
- Magic link: {{ .ConfirmationURL }}
- Change email: {{ .ConfirmationURL }}
- Reset password: {{ .ConfirmationURL }}
- Reauthentication: {{ .Token }}

Implementation:
1. Paste each HTML file into its matching Supabase Authentication > Email Templates entry.
2. Do not append `&redirect_to=...` to `{{ .ConfirmationURL }}`. Configure allowed Redirect URLs in Supabase Auth URL Configuration and set the redirect target in the application auth request (emailRedirectTo/redirectTo as appropriate). Appending query text can corrupt a URL that already contains parameters.
3. Confirm that the production domain is included in Supabase's allowed redirect URLs.
4. Reauthentication is presented as an OTP code for entry in the active verification flow. Confirm this matches the deployed Supabase reauthentication method.
5. Verify template variables against the project's deployed Supabase version and auth configuration before production.
6. Test desktop/mobile Gmail, Outlook and Apple Mail, including link expiry, one-time use, redirects and dark mode.
7. App-bundled self-hosted font files and CSS imports cannot be assumed available to external email clients. These templates declare the brand font families with resilient system fallbacks.

Security: do not include account IDs, private operational information, incident details, or personal/household data in authentication emails.
