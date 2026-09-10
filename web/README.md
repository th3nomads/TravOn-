# TravOn Web Migration

This folder contains the web version of TravOn.

## Cost requirement

The migration is intentionally designed for a **$0-only** deployment path.

Current phase:
- Static HTML, CSS, and JavaScript
- No paid APIs
- No billing account required
- Browser localStorage used for the first interactive prototype
- Existing iOS app remains untouched

Planned free backend phase:
- Cloudflare Pages for static hosting
- Cloudflare Workers Free for server endpoints if needed
- Cloudflare D1 Free for relational data
- Authentication solution must remain on a no-cost plan
- If a free quota is exceeded, functionality should stop rather than incur charges

## Web account requirements

TravOn will continue to use user accounts so itineraries can be saved and accessed across devices.

Account creation must require only:
- Email
- Password

The following information from the original iOS signup flow will **not** be required:
- Name
- Phone number
- Birth date
- Gender
- Profile photo

Optional profile information can be added later without blocking account creation.

Target onboarding flow:

**Create Account → Email + Password → Start Planning**

## Existing iOS features being migrated

The original app includes:
- Email/social authentication
- User profiles
- Friends and friend requests
- Saved locations
- Reviews/comments
- Itineraries
- Shared itineraries
- Daily itinerary activities
- Google Maps / Places integration

## Run locally

Open `index.html` directly in a browser, or serve the `web` directory with any static web server.

## Migration rule

Do not remove or rewrite the existing `TraviOS` iOS project during the web migration. Web work should stay under `web/` until the migration is mature enough to reorganize.
