# Facebook Auto-Login (1-Click OAuth) Setup

This guide covers the configuration that makes the Facebook sign-in button work. The code is already written and does not need changes:

- `signInWithFacebook` runs the OAuth flow in `client/src/context/AuthContext.tsx` (the 1-click path calls `supabase.auth.signInWithOAuth({ provider: 'facebook', options: { redirectTo, scopes: 'email,public_profile' } })`).
- The button is wired to `handleFacebookLogin` in `client/src/components/AuthModal.tsx`.
- The OAuth return lands on `client/src/components/AuthCallback.tsx`, which waits for Supabase to read the session and then routes to `/client`.
- After sign-in, `AuthContext` upserts the new customer into the Supabase `profiles` table.

Because the app delegates to Supabase, "adding auto-login" means configuring a Facebook app and connecting it to Supabase. There are three places to set up: Facebook, Supabase, and your local `.env`.

## What the flow does at runtime

1. The resident clicks the Facebook button.
2. `signInWithOAuth` redirects the browser to Facebook.
3. Facebook sends the user back to Supabase at `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Supabase creates the session and redirects to your app at `<origin>/client`.
5. `AuthCallback` reads the session and routes the resident into the client portal.

So Facebook has to trust Supabase's callback URL, and Supabase has to trust your app's origin.

## Step 1: Create the Facebook app

1. Go to https://developers.facebook.com and sign in.
2. Open **My Apps**, then **Create App**.
3. For the use case, choose **Authenticate and request data from users with Facebook Login**.
4. Set the app type to **Consumer** when prompted, give the app a name, and finish creating it.
5. In the left sidebar, open **Facebook Login**, then **Settings**.
6. In **Valid OAuth Redirect URIs**, add your Supabase callback URL:

   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

   Your project ref appears in the code comments as `owhodkhzldygavuwnqfg`, so for this project the URL is `https://owhodkhzldygavuwnqfg.supabase.co/auth/v1/callback`. Confirm the ref against `SUPABASE_URL` in your real `.env`.
7. Save changes.

## Step 2: Copy the app credentials

1. In the Facebook app, open **App settings**, then **Basic**.
2. Copy the **App ID**.
3. Click **Show** next to **App Secret**, confirm your password, and copy the secret.

Keep the App Secret private. Do not commit it or paste it into client code. It lives only in Supabase and in environment variables that stay out of version control.

## Step 3: Enable Facebook in Supabase

1. Open the Supabase dashboard for the project, then **Authentication**, then **Providers**.
2. Find **Facebook** and turn it on.
3. Paste the **App ID** into the Client ID field and the **App Secret** into the Secret field.
4. Save.

While you are in Authentication, open **URL Configuration** and confirm:

- **Site URL** matches your app origin. For local development that is `http://localhost:5173` (the value of `CLIENT_ORIGIN`).
- **Redirect URLs** include the path the app returns to. Add `http://localhost:5173/client` and, for production, your deployed origin plus `/client`.

If these are missing, Supabase blocks the redirect after sign-in and the resident lands back on the login screen.

## Step 4: Set the environment variables

The client reads its Supabase connection from the front-end environment. Confirm these are present and point at the same project whose ref you used in Step 1:

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
```

See `.env.example` for the full template. The anon key is safe to expose to the browser. The service role key and App Secret are not, so never ship them to the client.

## Step 5: Request email and public_profile access

The app asks Facebook for `email` and `public_profile`. Both are granted to the app's own admins, developers, and test users without review, which is enough while you build and test.

To let any Facebook user sign in, the app needs these permissions under standard access and must be switched to Live:

1. In the Facebook app, open **App Review**, then **Permissions and Features**.
2. Confirm `email` and `public_profile` show standard access. Request it if they do not.
3. Add a Privacy Policy URL under **App settings**, then **Basic** (Facebook requires one before going Live).
4. Flip the app status toggle at the top from **In development** to **Live**.

Email access for a live app can require business verification. Until the app is Live, only users you add as testers can sign in.

## Step 6: Test it

1. Start the app and open the resident login.
2. Click **Facebook**.
3. Approve the Facebook permission prompt.
4. You should return to `/client` signed in, with a welcome toast and a new row in the Supabase `profiles` table.

If the window returns to the login screen instead of the client portal, the cause is almost always a mismatch between the URLs in Step 1 and Step 3. Check that the Supabase callback URL in Facebook and the redirect URLs in Supabase both match exactly, including `http` vs `https` and the port.

## Common errors

- **"URL blocked" or "redirect_uri is not allowed"**: the callback in Facebook does not match the Supabase project. Recheck the ref and the exact `https://<ref>.supabase.co/auth/v1/callback` string.
- **Returns to login with no session**: the app origin or `/client` path is missing from Supabase URL Configuration.
- **"App not active" or only admins can log in**: the Facebook app is still In development, or `email` lacks standard access. Add testers, or complete App Review and go Live.
- **No email on the profile**: the user denied the email permission, or the live app has not passed business verification. The code falls back to a generated address, so sign-in still completes.
