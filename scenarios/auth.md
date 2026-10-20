# Authentication

## Current login methods

- Email and password login remains available.
- Kakao login uses the Supabase custom OIDC provider
  `custom:kakao-no-email` and requests only `openid`, `profile_nickname`, and
  `profile_image`.
- Kakao account email is intentionally not requested because it requires
  additional Kakao app permission and Budget uses `auth.uid()` as the user
  identifier.
- The custom provider must keep **Allow users without an email** enabled.

The built-in Supabase Kakao provider cannot be used for this flow. Its current
implementation always adds `account_email` to the authorization request, and
client-provided scopes are appended instead of replacing the defaults. This
causes Kakao `KOE205` for a non-Biz Kakao app even when Supabase allows users
without an email.

### Custom Kakao OIDC provider configuration

- Provider identifier: `custom:kakao-no-email`
- Configuration method: Auto-discovery (OIDC)
- Issuer: `https://kauth.kakao.com`
- Scopes: `openid`, `profile_nickname`, `profile_image`
- Email optional: enabled
- PKCE: enabled
- Client ID: Kakao REST API key
- Client secret: Kakao Login client secret
- Kakao Developers: Kakao Login and OpenID Connect both enabled

## Known effects of email-less Kakao accounts

- `session.user.email` is empty, so UI that prints the account email needs a
  nickname or generic account-label fallback.
- Kakao-only users cannot use email/password login or email-based password
  recovery unless they add an email credential later.
- A separately-created email account cannot be matched automatically to an
  existing email-less Kakao account. Explicit identity linking is required to
  avoid duplicate Budget accounts.
- Email receipts, notifications, and recovery messages require a separate,
  consented email-collection flow if introduced later.
- Household creation, invite-code joining, expenses, onboarding persistence,
  and RLS access are unaffected because they use `auth.uid()` and household
  membership rather than email.

## Follow-up

- Replace the home account-email label with the Kakao nickname and profile
  image, with a safe fallback for providers that do not return profile data.
- Add Google login after the Kakao flow is verified in production.
- When Google login is added, define and test explicit identity-linking rules
  so a person using both providers does not accidentally create two accounts.
- Revisit Kakao email permission only if a concrete product feature requires
  email collection.
