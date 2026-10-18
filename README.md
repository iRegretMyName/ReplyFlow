# ReplyFlow · Institute website + admissions desk

A public website for a coaching institute, with a private admin panel behind it. Staff manage the institute's courses, FAQs, page text and photos in the admin panel, and the public website shows exactly those records. Visitors can send enquiries from the Contact page, and staff turn them into leads. Gemini drafts replies to enquiries, and a person always reviews and approves before anything is sent.

## Pages

| Address | What it is | Who can open it |
|---|---|---|
| `/` | Homepage: hero, key facts, featured course, how it works, common questions | Everyone |
| `/courses`, `/courses/<slug>` | Course list (search and class filter) and one page per course | Everyone |
| `/about`, `/contact`, `/faq` | About us, Contact (with the enquiry form), FAQ | Everyone |
| `/privacy`, `/terms` | Appear only once you've written them in the admin panel | Everyone |
| any other address | A proper "page not found" page (with a real 404 status) | Everyone |
| `/staff/login` | Staff sign-in (linked from the footer as "Staff Login") | Everyone (it only lets staff in) |
| `/admin/...` | Admin panel: Today, Leads, Follow-ups, Enquiries, Website | Signed-in staff only |

There is no public sign-up. Staff accounts are created in code (see below), and every admin API route rejects requests without a valid session.

## Stack
- **Client:** React + Vite (`client/`), no animation library (CSS transitions, `IntersectionObserver`)
- **Server:** Express (`server/`)
- **Storage:** a JSON file, `server/data/db.json`, plus uploaded images in `server/uploads/` (both created on first use)
- **AI:** Google Gemini (free tier), called only from the server
- **Sign-in:** server-side sessions in an HttpOnly cookie, passwords hashed with scrypt (built into Node)

## Setup
1. Install Node.js 18.17 or newer.
2. `npm install`
3. `cp .env.example .env` and add your `GEMINI_API_KEY` (Google AI Studio).
4. **Create your first staff account** (see "Staff accounts" below). Until you do, nobody can open the admin panel.
5. `npm run dev`, then open http://localhost:5173 (the public website). Staff go to http://localhost:5173/staff/login.

The first run fills the database with **demo content** (an institute called "Apex Learning Institute", courses JEE / NEET / Foundation, and demo leads). Replace it in the admin panel, or delete `server/data/db.json` and restart to reset.

## Managing the website

Sign in at `/staff/login`, then open **Website** in the admin panel. It has four sections:

- **Courses:** add, edit, hide and delete courses. Each has a name, class, description, eligibility, highlights, curriculum, an image, and facts (duration, batch timings, fee, location, demo availability). The page address (`/courses/<slug>`) is made from the name unless you set it. "Feature on the homepage" puts a course in the homepage's featured spot. Deleting asks for confirmation.
- **FAQs:** your own questions, in the order you choose, shown or hidden. The FAQ page also adds automatic answers built from your records (courses, fees, timings, demo classes, address, contact details). A fact that isn't saved never produces a question.
- **Pages:** an announcement banner, the homepage headline/subtitle/photo, the About page (your story, photo, up to six values), and your privacy policy and terms.
- **Institute:** name, phone, WhatsApp, email, address, opening hours, website, Instagram, Facebook, YouTube.

Anything left blank is simply not shown. Changes appear on the public site straight away, because both read the same records.

The facts on a course are also the only facts the AI assistant may state, so one edit keeps the website and the AI in agreement. Renaming a course carries its leads and facts along; deleting one leaves existing leads with the course name as plain text.

Only **administrators** can change website content. Staff with the `staff` role can see it but not change it (the server enforces this).

### Images
Course pictures, the homepage photo and the About photo are uploaded in the admin panel: JPEG, PNG or WebP, up to 2 MB. The server checks the file's real contents (not its name or claimed type), refuses SVG and anything else, and stores it under a random name. Replacing or deleting an image deletes its file, and unused files are cleaned out when the server starts. Without an image, a course gets a generated answer-sheet pattern in the site's style. **No photographs ship with the site**, so add your own (you must have the rights to use them).

### Enquiries
The Contact page form sends enquiries to the server, which validates and saves them. Staff see them under **Enquiries** (with a badge for new ones), can mark them *new / in progress / resolved*, and press **Add to leads** to create a lead (source "Website", with the message as the first thing the student said). Only administrators can delete one.

Spam protection: a hidden field that people never see (bots fill it in and are quietly ignored), a limit of 5 enquiries per visitor address per hour (`ENQUIRY_LIMIT_PER_HOUR`), and the same cross-site checks as the rest of the API. **There is no email notification** (the project has no email service): staff see enquiries in the admin panel.

### How content is stored
Everything lives in `server/data/db.json`, written safely (to a temporary file, then renamed) on every change, so it survives refreshes and restarts. Uploaded images are in `server/uploads/`. **Back up both** by copying them. This is a good fit for one server and a modest amount of content. For several servers or heavy traffic, replace `server/data/store.js` with a real database (and keep images in shared storage); nothing else touches the file directly.

## Staff accounts

Accounts live in **`server/config/staff-accounts.js`**. The website has no screen for adding, changing or listing staff.

### Add a person
1. In a terminal, in the project folder: `npm run staff:hash`
2. Type a password when asked. It is hidden, you type it twice, and it must be at least 12 characters (a few random words joined together is good).
3. It prints a line like `passwordHash: 'scrypt$65536$8$2$…'`. Copy it.
4. Open `server/config/staff-accounts.js`, remove the `//` from the example entry (or copy it) and fill it in:
   ```js
   {
     id: 'asha',                  // short unique label
     username: 'asha',            // what they type to sign in
     displayName: 'Asha Verma',   // how they appear in the app
     role: 'admin',               // 'admin' or 'staff' (see below)
     enabled: true,
     passwordHash: 'scrypt$65536$8$2$…',   // pasted from step 3
   },
   ```
5. Restart the server (Ctrl+C, then `npm run dev` again). If the file has a mistake, the server refuses to start and tells you which account and what to fix.

### Change a password
Run `npm run staff:hash` again, replace that person's `passwordHash`, restart.

### Remove or pause someone
Set `enabled: false` (or delete the entry) and restart. Their open sessions end when the server restarts.

### Roles
- **`admin`** can do everything, including changing the website's content (courses, FAQs, pages, institute details, images) and deleting enquiries.
- **`staff`** (the default) can do everything else, including working enquiries and leads; website content is read-only for them. The server enforces this, not just the screen.

Never type a plain password into the file. A `passwordHash` can't be turned back into the password, but it is still sensitive, so keep the project in a **private** repository and use strong passwords.

## How sign-in is protected
- Passwords are checked on the server against scrypt hashes (random salt per account, 64 MiB memory cost).
- Wrong password, unknown username and disabled account all give the same message and take similar time.
- 5 wrong attempts for one username from one address, or 20 from one address in total, blocks that source for 15 minutes.
- Sessions end after 2 hours without activity (renewed by use) or 12 hours in total. Signing out ends the session on the server. Settings are in `.env.example`.
- The session cookie is `HttpOnly` and `SameSite=Strict`. In production it is also `Secure` with the `__Host-` prefix.
- Requests that change data must carry a custom header and, if the browser names an origin, it must be this site (CSRF protection).
- Every `/api` route requires a valid session except the sign-in routes and the public routes: the read-only site data, the legal text, and the enquiry form. Public responses are built field by field from an allow-list.
- Course and institute changes are validated on the server (types, lengths, duplicate names, `https://` links only), and administrator-typed text is always shown as plain text on the website.
- Every other admin API route requires a valid session; the account is re-checked on every request, so disabling it takes effect straight away.
- Credentials and password hashes are never logged or sent to the browser.

## Running in production
1. `npm run build` creates `dist/`. The server then serves the website, the admin panel and the API from the same address. In this mode the **server itself** redirects anyone without a session from `/admin/...` to `/staff/login`. (Under `npm run dev`, Vite serves the pages and the redirect happens in the browser instead. The API is protected either way.)
2. Set `NODE_ENV=production` and serve it over **HTTPS** (a reverse proxy or your host's TLS). Cookies are `Secure` in production, so sign-in needs HTTPS.
3. Behind a proxy, set `TRUST_PROXY` to the number of proxies (usually `1`) so rate limiting sees real visitor addresses.
4. `npm start`

Sessions are kept in memory: restarting the server signs everyone out. That is fine for one server; for several servers you would move sessions to a shared store.

## Tests
`npm test` runs the sign-in, authorization, public-site, course, FAQ, page-content, upload and enquiry tests (Node's built-in runner, nothing extra to install). They use a throwaway database, never your real one.

## Using the admin panel
- **Today:** what needs attention now: follow-ups due, new website enquiries, hot leads, recent enquiries.
- **Leads:** search and filter, open a lead, paste the student's enquiry in the AI assistant, *Analyse & draft reply*, edit the draft, then *Approve & send*. Approving logs the message (with who sent it), updates category, intent and interest, and schedules a check-in.
- **Follow-ups:** grouped as overdue, due today and coming up. Mark done or cancel.
- **Enquiries:** messages from the website's contact form (see above).
- **Website:** courses, FAQs, pages, institute details. "View website" in the account menu opens the public site.

## Privacy
Only the course, class, source and status are sent to Gemini. Names and phone numbers stay on your machine.

## Not yet included
- **Email or SMS notification** of new enquiries, and sending replies over WhatsApp, email or SMS (the app only logs them)
- **Testimonials, gallery, team/faculty, blog and events pages:** the project has no real content for them, and none is invented. They can be added when you have genuine material.
- **Image resizing:** uploads are stored as they are (2 MB limit), so prefer web-sized images
- **Server-side rendering:** pages are drawn in the browser. Search engines that run JavaScript (like Google) read them, and each page sets its own title, description and sharing tags. Unknown addresses return a real 404.
- A "forgot password" flow (by design: an administrator resets it in code)
- A real database (`store.js` is the only file to replace)
