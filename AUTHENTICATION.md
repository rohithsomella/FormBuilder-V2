# FormBuilder V1 — Authentication & Authorization

**ASP.NET Core Identity + JWT + Admin/User roles**

This document explains the authentication system added to FormBuilder: what was built,
why each piece exists, and the complete end-to-end code path from typing a password to
signing out.

---

## Table of contents

1. [What was built](#1-what-was-built)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [The core concept: authentication vs authorization](#3-the-core-concept-authentication-vs-authorization)
4. [ASP.NET Core Identity — what it owns](#4-aspnet-core-identity--what-it-owns)
5. [JWT — structure, claims and validation](#5-jwt--structure-claims-and-validation)
6. [Roles — how "Admin" is decided](#6-roles--how-admin-is-decided)
7. [The single login (username OR email)](#7-the-single-login-username-or-email)
8. [The page guard](#8-the-page-guard)
9. [END-TO-END CODE FLOW](#9-end-to-end-code-flow)
10. [Security properties](#10-security-properties)
11. [File map](#11-file-map)
12. [Configuration reference](#12-configuration-reference)
13. [Test results](#13-test-results)
14. [Future extensibility (V2 / V3)](#14-future-extensibility-v2--v3)

---

## 1. What was built

Before this work there was **no backend authentication of any kind**. The "session" was
entirely fictional — three separate files each invented a hardcoded user in
`localStorage`, and `login.html` compared against a literal `admin` / `admin123` in
JavaScript.

What replaced it:

```text
BEFORE                                  AFTER
------                                  -----
localStorage.fb_currentUser =           POST /api/auth/login
  { name:'Admin User',                       |
    role:'admin' }                      ASP.NET Core Identity
  (invented by the browser)                  |
                                        PasswordHasher verifies
if (email === 'admin' &&                     |
    password === 'admin123')            AspNetUserRoles -> "Admin"
  (hardcoded in JS)                          |
                                        Signed JWT (HMAC-SHA256)
No token. No API validation.                 |
No 401. No 403.                         API validates on every request
```

Delivered in V1:

| Capability | Status |
|---|---|
| ASP.NET Core Identity on SQL Server | Done |
| EF Core migration creating the 7 `AspNet*` tables | Done, applied |
| JWT bearer issuing + validation | Done |
| Single login accepting username **or** email | Done |
| Admin / User roles + `[Authorize(Roles = "Admin")]` | Done |
| Logout | Done |
| Home page routing by role | Done |
| Separate Admin and User profile pages | Done |
| Frontend page guard (Dev + Production modes) | Done |

Deliberately **not** built in V1: refresh tokens, session management, audit logging, MFA,
custom password policy, permission tables, tenant authorization, custom authorization
middleware.

---

## 2. Architecture at a glance

The two data stores keep their existing jobs. Identity was added to SQL Server; MongoDB
was not touched.

```text
                        FormBuilder
                             |
        +--------------------+--------------------+
        |                                         |
   SQL SERVER                                  MONGODB
   (FormBuilderApp)                          (FormBuilderDB)
        |                                         |
        +-- AspNetUsers          <- NEW           +-- Forms
        +-- AspNetRoles          <- NEW           +-- FormSubmissions
        +-- AspNetUserRoles      <- NEW           +-- Resources
        +-- AspNetUserClaims     <- NEW           +-- ResourceGroups
        +-- AspNetRoleClaims     <- NEW
        +-- AspNetUserLogins     <- NEW
        +-- AspNetUserTokens     <- NEW
        +-- __EFMigrationsHistory<- NEW
        |
        +-- Tenants              (unchanged, Dapper + stored procedures)
        +-- Forms / FormSubmissions / Resources  (legacy tables, unchanged)
```

Two data-access styles now coexist, on purpose:

```text
EXISTING FEATURES                    IDENTITY
-----------------                    --------
Controller                           AuthController
    |                                    |
Service                              AuthService
    |                                    |
Repository                           UserManager / SignInManager
    |                                    |
Stored Procedure (Dapper)            EF Core
    |                                    |
SQL Server / MongoDB                 SQL Server
```

There is **no `IAuthRepository` and no authentication stored procedure**. `UserManager`
*is* the repository — it already implements user lookup, password hashing, password
verification and role management. Wrapping it in a hand-written repository or forcing it
through stored procedures would mean reimplementing the exact things Identity exists to
provide, and would be the first step toward hand-rolled password handling.

> **Nothing in the system ever reads or compares a password in SQL.** No stored procedure
> touches `PasswordHash`.

---

## 3. The core concept: authentication vs authorization

These are two separate questions, answered in two separate places, in a fixed order.

```text
   AUTHENTICATION                        AUTHORIZATION
   "Who is this user?"                   "What may this user do?"

   Username/Email + Password             Validated identity + roles
            |                                      |
   ASP.NET Core Identity                 ASP.NET Core Authorization
            |                                      |
   PasswordHasher verifies               [Authorize]
            |                            [Authorize(Roles = "Admin")]
   Identity user + roles                          |
            |                                 Allow / 403
          JWT
```

In the request pipeline this ordering is literal —
[Program.cs:177-178](FormBuilderAppService/Program.cs#L177):

```csharp
app.UseAuthentication();   // works out WHO the caller is, from the token
app.UseAuthorization();    // decides WHETHER they may proceed
```

The order is not stylistic. `UseAuthorization()` decides using the identity that
`UseAuthentication()` established. Reverse them and authorization runs against an empty
identity, so every `[Authorize]` endpoint silently becomes anonymous. The original
`Program.cs` had `UseAuthorization()` with **no** `UseAuthentication()` at all — which is
why adding the call was a required part of this work, not a formality.

---

## 4. ASP.NET Core Identity — what it owns

Identity was adopted wholesale rather than partially. It owns:

```text
Users .................. AspNetUsers
Passwords (hashed) ..... AspNetUsers.PasswordHash
Roles .................. AspNetRoles
User-role mapping ...... AspNetUserRoles
Claims ................. AspNetUserClaims / AspNetRoleClaims
Security stamps ........ AspNetUsers.SecurityStamp
Lockout counters ....... AspNetUsers.AccessFailedCount / LockoutEnd
External logins ........ AspNetUserLogins
Tokens ................. AspNetUserTokens
```

### The model

[ApplicationUser.cs](FormBuilderAppService/Models/Identity/ApplicationUser.cs) derives
from `IdentityUser<Guid>` and adds exactly one field:

```csharp
public class ApplicationUser : IdentityUser<Guid>
{
    public string? FullName { get; set; }
}
```

The one decision worth recording:

- **`Guid` keys, not the default `string`.** Every other identifier in the schema
  (`FormId`, `SubmissionId`, and `Tenants.TenantId`) is `UNIQUEIDENTIFIER`. Matching that
  now avoids a key-type migration later, when `AspNetUsers` is populated and the change
  becomes genuinely painful.

Nothing else is added. The table carries exactly the 15 columns Identity defines plus
`FullName`. Multi-tenancy is a V3 concern and is **not** anticipated in the schema —
see [Future extensibility](#14-future-extensibility-v2--v3) for how it would be added
when the requirement is real rather than hypothetical.

### The DbContext

[AppIdentityDbContext.cs](FormBuilderAppService/Data/AppIdentityDbContext.cs) maps
**only** the Identity tables. No existing table is mapped, so a migration generated from
this context is structurally incapable of altering `Forms`, `Tenants`, `FormSubmissions`
or `Resources`.

### The migrations

Two migrations exist, both applied:

```text
20260817112357_InitialIdentity      creates the 7 AspNet* tables
20260817121350_RemoveUserTenantId   drops the speculative AspNetUsers.TenantId column
```

`InitialIdentity` contains no `AlterTable` or `DropColumn`, and its only `DropTable`
calls are inside `Down()` against `AspNet*` — it cannot touch `Forms`, `Tenants`,
`FormSubmissions` or `Resources`.

To recreate them on a new database:

```bash
dotnet ef database update --project FormBuilderAppService/FormBuilderAppService.csproj --context AppIdentityDbContext
```

To add a further migration later:

```bash
dotnet ef migrations add <Name> --project FormBuilderAppService/FormBuilderAppService.csproj --context AppIdentityDbContext
```

`dotnet-ef` is installed as a **repo-local tool** (`.config/dotnet-tools.json`), so the
version is pinned and committed rather than depending on what happens to be installed
globally on a given machine. Run `dotnet tool restore` on a fresh clone.

`SQL/Main DB Tables.sql` carries a comment block recording that these tables are
EF-owned and must not be created by hand.

### Seeding

[IdentitySeeder.cs](FormBuilderAppService/Data/IdentitySeeder.cs) runs at startup
([Program.cs:160](FormBuilderAppService/Program.cs#L160)) and:

1. Ensures the `Admin` and `User` roles exist — **always**, even when user seeding is
   disabled, because `[Authorize(Roles = "Admin")]` is meaningless if the role is absent.
2. Creates the accounts listed in the `IdentitySeed` configuration section.

Two properties of the seeder matter:

- **No credential appears in C#.** Usernames, emails, passwords and role lists all come
  from configuration. The seeded admin can be changed without a rebuild.
- **Create-if-missing only.** Existing accounts are never modified, so seeding cannot
  silently reset a password on an established database. (Consequence: editing a password
  in config does *not* change an account that already exists — delete the row first.)

---

## 5. JWT — structure, claims and validation

### What the token carries

Built in [JwtTokenService.CreateToken()](FormBuilderAppService/Services/JwtTokenService.cs#L44):

```text
+---------------------------------------------------------------+
| HEADER      { "alg": "HS256", "typ": "JWT" }                   |
+---------------------------------------------------------------+
| PAYLOAD                                                        |
|   ClaimTypes.NameIdentifier -> user.Id      (Guid)             |
|   ClaimTypes.Name           -> user.UserName                   |
|   ClaimTypes.Email          -> user.Email                      |
|   ClaimTypes.Role           -> "Admin"   (one claim per role)  |
|   jti                       -> new Guid  (unique token id)     |
|   iat / nbf / exp           -> issued / not-before / expiry    |
|   iss                       -> "FormBuilder"                   |
|   aud                       -> "FormBuilderClient"             |
+---------------------------------------------------------------+
| SIGNATURE   HMAC-SHA256( header.payload, Jwt:SecretKey )       |
+---------------------------------------------------------------+
```

The role claims come from `UserManager.GetRolesAsync(user)`
([AuthService.cs:114](FormBuilderAppService/Services/AuthService.cs#L114)) — that is,
straight out of `AspNetUserRoles`. `CreateToken` has no other source of roles; the
request cannot influence them.

`jti` is not used in V1. It is there so a V2 revocation or refresh-token story has a
per-token handle to work with, without changing the token format.

### How the token is validated

[Program.cs:113-131](FormBuilderAppService/Program.cs#L113):

```csharp
options.TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,     // signature must verify
    IssuerSigningKey         = new SymmetricSecurityKey(...),
    ValidateIssuer           = true,     // iss must be "FormBuilder"
    ValidIssuer              = jwtSettings.Issuer,
    ValidateAudience         = true,     // aud must be "FormBuilderClient"
    ValidAudience            = jwtSettings.Audience,
    ValidateLifetime         = true,     // exp must be in the future
    ClockSkew                = TimeSpan.Zero
};
```

`ClockSkew = TimeSpan.Zero` overrides the framework default of **five minutes**. Left at
the default, a token stays accepted for five minutes past its stated expiry — surprising
behaviour when testing expiry, and five minutes of unintended validity in production.

### Key handling

The signing key is never hardcoded. [JwtTokenService](FormBuilderAppService/Services/JwtTokenService.cs#L21)
refuses to construct if the key is missing or shorter than 32 bytes:

```csharp
private const int MinimumSecretKeyBytes = 32;   // HMAC-SHA256 needs 256 bits
```

This fails at **startup**, not on the first login — a misconfigured deployment cannot
quietly run while signing tokens with a weak or empty key.

```text
appsettings.json                 SecretKey: ""        <- COMMITTED, deliberately empty
appsettings.Development.json     SecretKey: "<dev>"   <- GIT-IGNORED, throwaway local key
Production                       JWT__SECRETKEY env var, or user-secrets
```

Two independent guards mean a signing key cannot reach the repository:

1. `appsettings.json` — the committed file — holds an empty key by design.
2. `appsettings.Development.json` — the file that holds a real one — is git-ignored
   (`.gitignore`), so it is never staged in the first place.

---

## 6. Roles — how "Admin" is decided

V1 has exactly two roles, declared as constants in
[AuthDtos.cs](FormBuilderAppService/Models/DTO/Auth/AuthDtos.cs):

```csharp
public static class RoleNames
{
    public const string Admin = "Admin";
    public const string User  = "User";
}
```

Constants rather than string literals so a typo in an `[Authorize(Roles = ...)]`
attribute is a **compile error** instead of a silent 403 nobody notices.

### The chain of custody for "is this an admin?"

```text
appsettings   IdentitySeed.Users[].Roles = [ "Admin" ]
    |
    v
IdentitySeeder.EnsureRoleAssignmentsAsync()
    |         UserManager.AddToRoleAsync(user, "Admin")
    v
AspNetUserRoles      <-- the single source of truth
    |
    v
UserManager.GetRolesAsync(user)      (at login time)
    |
    v
Claim(ClaimTypes.Role, "Admin")      (inside the signed token)
    |
    v
[Authorize(Roles = "Admin")]         (enforced by the framework)
```

**Nothing in the codebase compares a username or an email to decide admin status.** There
is no `if (username == "rohithsomella")` anywhere. Renaming the account changes nothing;
removing its `AspNetUserRoles` row removes its admin rights immediately at next login.

### Expected behaviour

```text
No token            ->  401 Unauthorized
Invalid/expired     ->  401 Unauthorized
Valid User token    ->  [Authorize]                -> 200 Allowed
Valid User token    ->  [Authorize(Roles="Admin")] -> 403 Forbidden
Valid Admin token   ->  [Authorize(Roles="Admin")] -> 200 Allowed
```

---

## 7. The single login (username OR email)

There is exactly **one** login endpoint and **one** login form. There is no separate
admin sign-in. The backend determines the role after authenticating.

```json
POST /api/auth/login
{
    "loginIdentifier": "rohithsomella",
    "password": "********"
}
```

`loginIdentifier` holds either a username or an email.
[AuthService.FindByIdentifierAsync()](FormBuilderAppService/Services/AuthService.cs#L95)
resolves it:

```text
                    loginIdentifier
                          |
                 does it contain '@' ?
                    /            \
                  YES             NO
                   |               |
          FindByEmailAsync   FindByNameAsync
                   |               |
              (if null)        (if null)
                   |               |
          FindByNameAsync   FindByEmailAsync     <- fallback both ways
                    \            /
                     \          /
                   ApplicationUser or null
```

The `'@'` test only picks which lookup to try **first**; the other is always tried as a
fallback. This matters for two real cases: a username that legitimately contains `@`, and
an email stored in the `UserName` column. Neither would resolve with a naive one-way
branch.

Password verification is delegated entirely
([AuthService.cs:54](FormBuilderAppService/Services/AuthService.cs#L54)):

```csharp
var result = await _signInManager.CheckPasswordSignInAsync(
    user, request.Password, lockoutOnFailure: true);
```

`lockoutOnFailure: true` records failed attempts against the account. V1 does not
configure a lockout policy, but the counter is being maintained from day one, so enabling
lockout in V2 is a configuration change rather than a behavioural one.

### Failure handling — no user enumeration

Every failure path returns the **same** status and the **same** string
([AuthController.cs:19](FormBuilderAppService/Controllers/AuthController.cs#L19)):

```csharp
private const string InvalidCredentialsMessage = "Invalid username or password.";
```

```text
Unknown user       ->  401  "Invalid username or password."
Wrong password     ->  401  "Invalid username or password."
Empty fields       ->  401  "Invalid username or password."
Locked out         ->  401  "Invalid username or password."
```

> **Subtle point worth remembering.** `LoginRequest` carries **no** `[Required]`
> attributes, and that is deliberate. With `[ApiController]`, a failed validation
> attribute short-circuits into a `400` with field-level detail *before the action runs*
> — which would make "you left the password blank" externally distinguishable from "that
> password is wrong", and would leave the handler's own check as dead code. Empty values
> are therefore checked inside the action instead. This was caught by the test suite
> during development: empty credentials were returning 400 while wrong passwords returned
> 401.

---

## 8. The page guard

There is **one rule**, applied in every environment, with no mode switch and no
exceptions:

```text
        any protected page
                |
        <head> loads auth.js
                |
        guard runs immediately (synchronous, no network call)
                |
        valid token in localStorage?
           /                       YES               NO
          |                 |
      page renders    clearSession()
                      redirect to login.html
                      (before <body> is parsed)
```

Two properties make this hard to get wrong:

1. **Protection is a property of the include.** `auth.js` runs the guard itself on load,
   so no page has to remember to call anything.
2. **It is synchronous.** No config lookup, no `await`. When reached from `<head>` the
   redirect happens before the body exists, so protected markup never renders.

A page that must stay public opts out explicitly:

```html
<script src="../js/auth.js" data-no-guard></script>
```

`login.html` needs no attribute - `isLoginPage()` already exempts it.

### Two bugs this design replaced

Both were found by manual testing after the first implementation, and both are worth
recording because the fix is shaped by them.

**1. Logout could be undone by opening a new tab.**

The guard used to have a development shortcut: no token, running in Development, so
silently fetch one from a passwordless endpoint. To stop that from defeating logout,
`Auth.logout()` set a `fb_signedOut` flag.

The flag lived in `sessionStorage`, which is **scoped to a single tab**:

```text
Tab 1 (logout)                      Tab 2 (new)
--------------                      -----------
localStorage.fb_token   removed ->  absent        (shared - correct)
sessionStorage.fb_signedOut = 1     NOT VISIBLE   (per-tab - the hole)
                                          |
                                    guard: no token, not signed out
                                          |
                                    passwordless Admin token, page opens
```

A signed-out user who pasted any protected URL into a new tab was silently signed back
in **as Admin**.

**2. `previewPage.html` was never guarded at all.**

The guard only ran if a page script called `requireAuth()`, which arrived via
`CommonItems.js` on most pages. `previewPage.html` loads neither `CommonItems.js` nor any
guarding script, so it had `auth.js` in its `<head>` and was completely open - in every
environment, signed in or not.

**The fix for both:** the guard became automatic (fixing #2 for every current and future
page) and unconditional (fixing #1 by removing the silent re-authentication entirely).
The development shortcut - the endpoint, the `Auth:Mode` setting, the `AuthSettings`
class and the `/api/auth/config` endpoint that existed to gate it - was removed
altogether rather than repaired. It saved typing a password roughly once an hour, against
a passwordless-admin-token path that had already produced one security hole.

Signing in with a username and password is now the only way to obtain a session.

---

## 9. END-TO-END CODE FLOW

### Flow 1 — Login

```text
  BROWSER                                      API                             SQL
  -------                                      ---                             ---

  login.html
  user types identifier + password
       |
       | form submit                      login.html:93
       v
  Auth.login(identifier, password)        auth.js:179
       |
       | fetch POST /api/auth/login
       |------------------------------------->
       |                             AuthController.Login()        AuthController.cs:43
       |                                   |
       |                                   | empty-field check -> 401 if blank
       |                                   v
       |                             AuthService.LoginAsync()      AuthService.cs:32
       |                                   |
       |                                   v
       |                             FindByIdentifierAsync()       AuthService.cs:95
       |                                   |  '@' ? email : username (with fallback)
       |                                   |------------------------> SELECT AspNetUsers
       |                                   |<------------------------ ApplicationUser
       |                                   v
       |                             SignInManager
       |                               .CheckPasswordSignInAsync()  AuthService.cs:54
       |                                   |  PasswordHasher verifies against
       |                                   |  AspNetUsers.PasswordHash
       |                                   |
       |                                   |  FAIL -> return null -> 401 generic message
       |                                   |
       |                                   v  SUCCESS
       |                             BuildLoginResponseAsync()      AuthService.cs:112
       |                                   |
       |                                   | UserManager.GetRolesAsync()
       |                                   |------------------------> SELECT AspNetUserRoles
       |                                   |<------------------------ [ "Admin" ]
       |                                   v
       |                             JwtTokenService.CreateToken()  JwtTokenService.cs:44
       |                                   |  claims: NameIdentifier, Name, Email,
       |                                   |          Role (per role), jti, iat
       |                                   |  sign: HMAC-SHA256 with Jwt:SecretKey
       |                                   v
       |<------------------------------ 200 { token, expiresAtUtc, user }
       v
  Auth.storeSession(response)             auth.js:145
       |    localStorage.fb_token           = token
       |    localStorage.fb_tokenExpiresAt  = expiresAtUtc
       |    localStorage.fb_currentUser     = normalised user
       v
  window.location.href = Auth.consumeReturnUrl()   login.html:111
       |
       v
  homePage.html      (BOTH Admin and User land here)
```

Note the normalisation step in [`toStoredUser()`](FormBuilderJs/app/js/auth.js#L128). The
stored object carries the real fields (`userId`, `userName`, `roles`, `isAdmin`) *and*
compatibility aliases `name` and `role`, because pages written before this system existed
read `user.name` and `user.role`.

### Flow 2 — Landing on Home

Both roles land on the **same** page. There is no separate admin home.

```text
  homePage.html loads
       |
       | <script src="app/js/auth.js"> in <head>
       v
  auth.js runs its own guard on load     auth.js - autoGuard()
       |
  Auth.requireAuth()                     auth.js:286
       |
       +-- token present and unexpired? --> YES --> resolve immediately
       |
       +-- NO --> clearSession()
                  hidePage()
                  goToLogin()   (remembers the return URL, redirects at once)
       |
       v  (authenticated)
  updateHomeProfile()                     homePage.html:112
       |    avatar initials from user.name
       v
  Auth.refreshCurrentUser()               auth.js:233   homePage.html:164
       |    GET /api/auth/me with Bearer token
       |    -> re-reads the account from the API and rewrites the cache
       v
  updateHomeProfile()  again with authoritative data
```

`refreshCurrentUser()` is the reason a page refresh always shows the correct account:
the rendered identity comes from the API, not from whatever happens to be sitting in
`localStorage`.

### Flow 3 — Opening the profile (the role decision)

```text
  homePage.html — user clicks the avatar
       |
       v
  goToProfile()                           homePage.html:127
       |
       |   var user = Auth.getCurrentUser();
       |
       |   if (user.role === 'Admin')  ---------> app/html/adminProfile.html
       |   else                        ---------> app/html/userProfile.html
       v
  profile page loads
       |
       | <body data-profile-role="Admin">   (or "User")
       v
  userProfile.js  (shared by BOTH pages)
       |
       | Auth.requireAuth()                userProfile.js:17
       | Auth.refreshCurrentUser()         userProfile.js:22   <- authoritative role
       v
  routeToCorrectProfile(user)             userProfile.js:38
       |
       |   pageRole  = body.data-profile-role
       |   isAdminPage = (pageRole === 'Admin')
       |
       |   isAdminPage === user.isAdmin ?
       |        |                    |
       |       YES                   NO
       |        |                    |
       |     render()          location.replace(other page)   <- and STOP rendering
       v
  render(user)                            userProfile.js:48
       |
       +-- Admin page only: verifyAdminApiAccess()   userProfile.js:67
                |
                | GET /api/auth/admin-check   [Authorize(Roles="Admin")]
                |
                +-- 200 -> "Verified by API"
                +-- 403 -> "Denied by API (403)"
```

**Why two separate pages rather than one page with hidden sections.** Only one document
is ever loaded, so there is physically no hidden admin markup for a normal user to
inspect and no leftover section to clear when switching accounts. The stale-content
problem is designed out rather than defended against.

The `admin-check` call on the Admin profile is a live demonstration that the role is
real: a user who edits `localStorage` to look like an admin reaches the page markup, but
that badge reads **"Denied by API (403)"**, because the API decides independently.

### Flow 4 — An authenticated API call

No page and no existing API function has to remember to attach the token.
`FormBuilderApi.js` was **not modified at all**.

```text
  any page calls e.g. FormBuilderApi.getAllForms()
       |
       | $.ajax({ url: 'http://localhost:5155/api/forms', ... })
       v
  $.ajaxPrefilter                          auth.js:374
       |
       | isOurApi(url)?                    auth.js:428
       |     compares the resolved origin against the API origin,
       |     so a CDN request never receives the token
       |
       | YES -> options.headers.Authorization = 'Bearer ' + token
       v
  --------------------------------> API
                                     UseAuthentication()   Program.cs:177
                                          | validates signature/iss/aud/exp
                                          | builds ClaimsPrincipal from the token
                                          v
                                     UseAuthorization()    Program.cs:178
                                          | [Authorize] / [Authorize(Roles="Admin")]
                                          v
                                     Controller action
       |
       v
  $(document).ajaxError                    auth.js:374
       |
       | status === 401 -> handleUnauthorized()   auth.js:440
       |      (skipped for /auth/login - a rejected login attempt is the
       |       form's business, not a dead session)
       v
  clearSession() + redirect to login.html
```

A matching wrapper covers native `fetch` ([auth.js:400](FormBuilderJs/app/js/auth.js#L400))
for the one place in `main.js` that uses it, so the whole application is ready the day
the other controllers get `[Authorize]`.

### Flow 5 — Logout

```text
  Sign Out clicked (profile page, menu, or Home)
       |
       | confirm()
       v
  Auth.logout()                           auth.js:202
       |
       | POST /api/auth/logout  with Bearer token   (best-effort)
       |     AuthController.Logout()      AuthController.cs:110
       |     - logs the event
       |     - stateless JWT: nothing to revoke in V1
       |     - exists so V2 can add revocation without a client change
       |
       | .catch() -> ignored, so an unreachable API cannot trap
       |             the user in a signed-in state
       v
  clearSession()                          auth.js:159
       |    localStorage.removeItem('fb_token')
       |    localStorage.removeItem('fb_tokenExpiresAt')
       |    localStorage.removeItem('fb_currentUser')
       |
       |
       |    localStorage is shared by every tab of this origin, so removing the
       |    token here ends the session in ALL tabs, not just this one.
       v
  window.location.href = login.html
       |
       v
  login.html loads
       |
       | Auth.clearSession()               login.html:77
       |    belt-and-braces: arriving at the login page always ends any
       |    previous session, so a half-expired token or a stale profile
       |    can never bleed into the next sign-in
```

### Flow 6 — Account switching (the stale-state case)

```text
  Admin signed in                        Admin Profile visible
       |
       | Sign Out
       v
  token + fb_currentUser cleared          login.html
       |
       | sign in as testuser
       v
  storeSession() OVERWRITES fb_currentUser entirely
       |
       v
  homePage.html                           avatar "TU", role User
       |
       | click avatar -> goToProfile()
       |    user.role === 'User'
       v
  userProfile.html                        Admin Profile never loads
```

Three independent mechanisms prevent stale content:

1. `clearSession()` removes the cached user, it does not merge over it.
2. The two profiles are separate documents — the wrong one is never loaded.
3. `routeToCorrectProfile()` redirects on mismatch before rendering.

### Flow 7 — Direct URL access and expired tokens

```text
  Normal user types  /app/html/adminProfile.html
       |
       v
  Auth.requireAuth()  -> passes (they ARE signed in)
       |
       v
  routeToCorrectProfile()  -> data-profile-role "Admin" != user.isAdmin false
       |
       v
  location.replace('userProfile.html')
```

```text
  Token expires while the tab is open
       |
       | next API call returns 401
       v
  ajaxError / fetch wrapper -> handleUnauthorized()   auth.js:440
       |
       v
  clearSession() -> login.html
```

> **The frontend redirect is convenience, not protection.** It stops a user wandering
> into a screen that will not work for them. The actual protection is that
> `/api/auth/admin-check` returns **403** for that user regardless of which page they
> managed to open. This is verified by test, not assumed.

---

## 10. Security properties

| Property | How it is achieved |
|---|---|
| Passwords never stored in plain text | Identity `PasswordHasher`; nothing else writes `PasswordHash` |
| Passwords never compared in SQL | No stored procedure touches credentials |
| No user enumeration | Identical 401 + identical message for every failure |
| Empty fields indistinguishable from wrong ones | No `[Required]` on `LoginRequest`; checked in the action |
| Signature forgery rejected | `ValidateIssuerSigningKey`; verified by a tampered-signature test |
| Expired tokens rejected promptly | `ValidateLifetime` + `ClockSkew = TimeSpan.Zero` |
| Tokens from another system rejected | `ValidateIssuer` + `ValidateAudience` |
| Weak/missing signing key cannot ship | Startup throws below 32 bytes |
| No secret in source control | `appsettings.json` key is empty; env var in production |
| Admin cannot be faked from the client | Roles read from `AspNetUserRoles` at login only |
| Client-supplied role headers ignored | Verified by test — still 403 with `X-Role: Admin` |
| Token never leaks to third parties | `isOurApi()` compares origins before attaching the header |

### API protection

**Every controller requires a valid JWT.** `[Authorize]` is applied at class level:

| Controller | Attribute | Effect |
|---|---|---|
| `FormsController` | `[Authorize]` | No token → 401 |
| `FormSubmissionsController` | `[Authorize]` | No token → 401 |
| `ResourcesController` | `[Authorize]` | No token → 401 |
| `TenantController` | `[Authorize]` | No token → 401 |
| `PdfController` | `[Authorize]` | No token → 401 |
| `AuthController.AdminCheck` | `[Authorize(Roles = "Admin")]` | User token → 403 |
| `AuthController` login/config | `[AllowAnonymous]` | Reachable without a token |
| `PdfController.Health` | `[AllowAnonymous]` | Probeable by monitoring; reports readiness only |

No frontend page needed changing when these were applied: the `$.ajaxPrefilter` and the
`fetch` wrapper in `auth.js` already attach the token to every request aimed at the API.

**This, not the page guard, is the security boundary.** A page guard only decides what
the browser draws; anyone can bypass it with developer tools or by calling the API
directly. The 401/403 answers above are what actually protect the data, and they hold
regardless of what the browser was persuaded to display.

Role restrictions beyond the Admin-only check are not yet applied — for example, tenant
create/update/delete is currently available to any authenticated user. Narrowing that is
one attribute per action when the rules are decided.

### Known V1 trade-off

The token lives in `localStorage`, which is readable by any XSS on the page. This matches
the existing `fb_currentUser` pattern and keeps V1 small. The proper fix is an httpOnly
refresh cookie — which is exactly the V2 "refresh tokens" item.

---

## 11. File map

### Backend — created

```text
Models/Identity/ApplicationUser.cs        IdentityUser<Guid> + FullName
Models/Identity/ApplicationRole.cs        IdentityRole<Guid> + Description
Data/AppIdentityDbContext.cs              EF context, Identity tables only
Data/IdentitySeeder.cs                    Roles + config-driven seed accounts
Models/DTO/Auth/AuthDtos.cs               LoginRequest/Response, CurrentUserDto, RoleNames
Services/Interfaces/IJwtTokenService.cs
Services/JwtTokenService.cs               HMAC-SHA256 token issuing
Services/Interfaces/IAuthService.cs
Services/AuthService.cs                   Identifier resolution + sign-in
Controllers/AuthController.cs             The endpoints
Settings/JwtSettings.cs                   Jwt config binding
Settings/IdentitySeedSettings.cs          IdentitySeed config binding
Migrations/20260817112357_InitialIdentity.*
Migrations/20260817121350_RemoveUserTenantId.*
Migrations/AppIdentityDbContextModelSnapshot.cs
appsettings.Development.json.example      Committed template for local settings
```

### Backend — modified

```text
FormBuilderAppService.csproj    + Identity.EntityFrameworkCore, EFCore.SqlServer,
                                  EFCore.Design, Authentication.JwtBearer (8.0.11)
Program.cs                      DbContext, Identity, JwtBearer, UseAuthentication(),
                                Swagger bearer button, seeder invocation
appsettings.json                + Jwt / Auth / IdentitySeed  (safe defaults, no secrets)
```

### Repository — modified

```text
.gitignore                      + appsettings.Development.json, secrets.json
.config/dotnet-tools.json       created - pins dotnet-ef 8.0.30 as a local tool
SQL/Main DB Tables.sql          + comment block: Identity tables are EF-owned
```

`appsettings.Development.json` itself is **no longer tracked**. It was removed from the
index with `git rm --cached` (which leaves the working file on disk) and is now matched
by `.gitignore`. The signing key it holds was never committed — it was added as an
uncommitted working-tree change and untracked before any commit, so it is absent from
git history entirely.

### Frontend — created

```text
app/js/auth.js                  The entire client-side auth layer
app/html/adminProfile.html      Renamed from the extension-less `adminProfile`
```

The rename was **required**, not cosmetic: a file with no extension is served with the
wrong content type and downloads instead of rendering. The file was also a byte-identical
copy of `userProfile.html`, so there was no distinct Admin page before this work.

### Frontend — modified

```text
app/html/login.html             Rebuilt as the ONE login page
homePage.html                   Guard + real user + role routing + real logout
app/html/userProfile.html       Guard, data-profile-role="User", live fields
app/js/userProfile.js           Rewritten — see note below
app/js/CommonItems.js           Fake user removed; menu reads from Auth
index / existingForms / existingTenants / addResource /
reports / previewPage / userDetails .html      one <script src="../js/auth.js"> each
```

> **`userProfile.js` was broken before this work.** It queried `adminContainer`,
> `userCardContainer`, `tabBtnProfile`, `tabBtnEdit`, `btnSubmitEdit` and `btnEditUser` —
> IDs that existed in **no** HTML file in the repository. It threw on line 10 and never
> executed. It also branched on a `userhasadmin` flag that nothing ever set.

### Endpoint summary

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/auth/login` | Anonymous | The single login |
| `GET /api/auth/me` | `[Authorize]` | Authoritative current user |
| `POST /api/auth/logout` | `[Authorize]` | Logout hook |
| `GET /api/auth/admin-check` | `[Authorize(Roles="Admin")]` | Proves 401/403/200 |

---

## 12. Configuration reference

```jsonc
// appsettings.json — committed, safe defaults, NO secrets
"Jwt": {
    "SecretKey": "",                    // supplied per environment
    "Issuer": "FormBuilder",
    "Audience": "FormBuilderClient",
    "ExpirationMinutes": 60
},
"IdentitySeed": {
    "Enabled": false,
    "Users": []
}
```

```jsonc
// appsettings.Development.json — LOCAL ONLY, git-ignored, never committed
"Jwt":  { "SecretKey": "<throwaway dev key>" },
"IdentitySeed": {
    "Enabled": true,
    "Users": [
        { "UserName": "rohithsomella", "Email": "rohith.somella@formbuilder.local",
          "FullName": "Rohith Somella", "Password": "Admin@12345", "Roles": [ "Admin" ] },
        { "UserName": "testuser", "Email": "test.user@formbuilder.local",
          "FullName": "Test User", "Password": "User@12345", "Roles": [ "User" ] }
    ]
}
```

Production must supply the key out of band:

```bash
setx JWT__SECRETKEY "<a long random value>"
```

### Local development credentials

| Role | Username | Email | Password |
|---|---|---|---|
| Admin | `rohithsomella` | `rohith.somella@formbuilder.local` | `Admin@12345` |
| User | `testuser` | `test.user@formbuilder.local` | `User@12345` |

### Setting up a fresh clone

`appsettings.Development.json` is **git-ignored** and will not be present after a clone.
A committed template sits next to it:

```bash
copy FormBuilderAppService\appsettings.Development.json.example FormBuilderAppService\appsettings.Development.json
```

Then fill in `Jwt:SecretKey` with any value of 32 characters or more. The API refuses to
start without it, so a missing key fails loudly rather than silently signing tokens with
a weak value.

The template also carries the `PdfRenderer` development paths
(`../FormBuilderJs/dist`). Without them the renderer falls back to `wwwroot/pdf/dist`
from `appsettings.json`, which does not exist in a development checkout, and PDF
generation fails — so the copy step is required even if you do not care about
authentication.

### Standing issue

**The SQL `sa` password is in plain text** in `appsettings.json`, which *is* committed.
This predates the authentication work and was left untouched, but it should be rotated
and moved to a secret store or an environment variable.

---

## 13. Test results

### Authentication (login / token) - 28 checks

```text
THE FOUR LOGIN COMBINATIONS
  PASS  Test A - Admin + Username    200, roles=[Admin]
  PASS  Test B - Admin + Email       200, roles=[Admin], same userId as A
  PASS  Test C - User  + Username    200, roles=[User]
  PASS  Test D - User  + Email       200, roles=[User]

INVALID CREDENTIALS
  PASS  Wrong password               401 "Invalid username or password."
  PASS  Unknown user                 401 "Invalid username or password."
  PASS  No user enumeration          both messages identical
  PASS  Empty credentials            401  (was 400 before the fix)

TOKEN CONTENTS
  PASS  UserId, Role, iss, aud, exp all present and correct
```

### API authorization - 16 checks

```text
NO JWT -> 401
  PASS  GET /api/forms                       401
  PASS  GET /api/tenant                      401
  PASS  GET /api/resources                   401
  PASS  GET /api/formsubmissions/form/{id}   401
  PASS  GET /api/pdf/acroform/{id}           401

VALID JWT -> ALLOWED
  PASS  User  JWT: GET /api/forms   200      PASS  User  JWT: GET /api/tenant   200
  PASS  Admin JWT: GET /api/forms   200      PASS  Admin JWT: GET /api/tenant   200

ROLE ENFORCEMENT
  PASS  User JWT  -> /api/auth/admin-check   403
  PASS  Admin JWT -> /api/auth/admin-check   200
  PASS  Client-supplied "X-Role: Admin" header ignored          403

TOKEN VALIDATION
  PASS  Malformed token                                         401
  PASS  Tampered signature                                      401
  PASS  Self-signed token forging role=Admin (wrong key)        401
  PASS  Expired token, correctly signed                         401

ANONYMOUS BY DESIGN
  PASS  GET /api/pdf/health without a token                     200
```

### Page guards - all 10 protected pages

With **no token**, every page redirects to `login.html`:

```text
BLOCKED  homePage.html         BLOCKED  reports.html
BLOCKED  index.html            BLOCKED  previewPage.html
BLOCKED  existingForms.html    BLOCKED  userDetails.html
BLOCKED  existingTenants.html  BLOCKED  userProfile.html
BLOCKED  addResource.html      BLOCKED  adminProfile.html
```

| Scenario | Result |
|---|---|
| Admin -> page -> logout -> **new tab**, direct URL | `login.html` |
| User -> page -> logout -> **new tab**, direct URL | `login.html` |
| Expired token -> direct URL | `login.html`, forged session wiped |
| No token -> all 10 pages | `login.html` |
| Valid token -> all pages | load normally |

Verified additionally in a real browser: both roles land on the same Home page; Admin sees
the Admin Profile with "Verified by API"; a User typing the admin URL is redirected out
*and* gets 403 from the API; refresh preserves the correct profile; logout clears
everything; Admin -> User -> Admin switching leaves no stale profile; `/api/forms` still
returns 200 through the Bearer prefilter with no page changes.

> **Testing note.** Browsers cache `auth.js` and `login.html` aggressively on a static
> dev server. A guard change that appears not to work is very often a stale script -
> hard-reload (Ctrl+F5) before concluding anything. This bit during development: a page
> appeared unguarded after the fix purely because the tab was running the previous
> `auth.js`.

---

## 14. Future extensibility (V2 / V3)

The V1 foundation is meant to be **extended**, not replaced.

```text
V1  (built)            V2                        V3
----------             --                        --
User -> Role           Password management       Multiple roles per user
JWT                    Account security          Permissions
Admin / User           Refresh tokens            Role -> Permission mapping
[Authorize]            Session management        Tenant authorization
                       Audit logging             Resource-level authorization
```

What is already in place for each:

| Future need | Already present |
|---|---|
| Refresh / revocation | `jti` in every token; `/api/auth/logout` already exists |
| Lockout policy | `lockoutOnFailure: true` is already recording failures |
| Password policy | Identity options are configured in one place |
| Permissions | `ApplicationRole` is already derived — hang claims off `AspNetRoleClaims` |
| Multiple roles per user | Already supported — one `Role` claim is emitted per role |
| Locking down existing APIs | Token already attached to every request by the prefilter |

The target shape:

```text
User -> Tenant -> Role -> Permission -> Resource
```

Reaching it requires adding tables and policies. It does **not** require changing how
users are stored, how passwords are hashed, how tokens are issued, or how the frontend
authenticates.

### A note on tenancy

`AspNetUsers` carries **no tenant column**. An earlier draft added a nullable `TenantId`
speculatively; it was removed, because a column that is always `NULL` is not a design —
it is an unenforced guess about a requirement that has not been specified yet.

When multi-tenancy is actually built, the shape it needs will be known, and it is very
likely to be richer than one column on the user: a user may belong to several tenants, or
hold a different role in each. That is a `UserTenants` join table, not a scalar field.

Adding it later costs one migration. Because `ApplicationUser` and `ApplicationRole` are
already derived types and `JwtTokenService` builds its claim list from a `List<Claim>`,
a `tenant_id` claim can be introduced at that point without touching the login flow, the
password handling, the validation parameters or any frontend code.
