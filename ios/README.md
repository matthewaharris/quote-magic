# QuoteMagic — iOS app

Native SwiftUI app for QuoteMagic contractors. The Xcode project lives in this
directory.

**Start here:** [`../docs/ios-app-handoff.md`](../docs/ios-app-handoff.md) — full
architecture, the backend prerequisite (Bearer-token auth on `/api/*`), auth,
data model, App Store notes, and the phase plan. Also read `../CLAUDE.md` for the
backend architecture and data model.

Status: not yet scaffolded. Phase 0 (see the handoff doc) creates the SwiftUI
project here, adds `supabase-swift`, and ships OTP sign-in + a quotes list.

Config the app needs (both public, RLS-protected): `SUPABASE_URL` + the Supabase
**anon** key. No server secrets ever live in this app.
