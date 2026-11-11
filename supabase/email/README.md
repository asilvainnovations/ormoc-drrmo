# MODE Supabase email templates

Six updated Supabase Auth HTML templates.

- Official domain: https://www.mode-cddrmo-ormoc.online
- CDRRMO seal: https://www.mode-cddrmo-ormoc.online/brand/cdrrmo-seal-128.png
- MODE banner: https://www.mode-cddrmo-ormoc.online/brand/app-banner-800.jpg
- Support: cdrrmo.ormoccity@gmail.com
- Technical support: alvin.silva@asilvainnovations.com

Copy the six numbered HTML files into `supabase/email/`.

Before deployment, verify that both public image URLs load over HTTPS without authentication. The HTML references these image URLs directly. The layout uses table-based structure and inline CSS for email-client compatibility; the banner is an image element rather than a CSS background.

Supabase template variables retained:
- `{{ .ConfirmationURL }}` in templates 01–05.
- `{{ .Token }}` in template 06.

No authentication action URL or token has been hard-coded.

Images are PNG (seal) and JPG (banner), not WebP: Outlook for Windows does not display WebP images.
