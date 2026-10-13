// utils/authDeepLink.js
// The iOS app's magic-link return trip.
//
// window.location.origin resolves to capacitor://localhost inside Capacitor's
// WKWebView, a scheme nothing outside the app (Mail, Supabase's own redirect)
// can open, so the OTP email arrives but has nowhere to send the user back.
// A custom URL scheme (registered in ios/App/App/Info.plist as
// CFBundleURLTypes, matching PRODUCT_BUNDLE_IDENTIFIER) plus a
// @capacitor/app 'appUrlOpen' listener (AuthContext.jsx) replaces that round
// trip natively.
//
// supabaseAuth.js uses the PKCE flow, so the callback carries a one-time
// code, e.g. com.eyewallanalytics.app://login-callback?code=..., never the
// tokens themselves. Any app could register the same scheme, but a code it
// caught is no use without the verifier signInWithOtp stored in this app's
// WKWebView localStorage. That localStorage survives the trip out to Mail and
// back, so exchangeCodeForSession() finds the verifier. A link that still
// carries #access_token (an email sent before the switch to PKCE, or anyone
// crafting one) is ignored rather than trusted.
//
// The deep link never shows up in window.location, so detectSessionInUrl
// never sees it; the code is exchanged here instead.

export const NATIVE_AUTH_REDIRECT = 'com.eyewallanalytics.app://login-callback';

// Query and fragment parameters of the callback. Supabase reports a failed
// link (expired, already used) as error/error_description, in either part.
function callbackParams(url) {
  const params = {};
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = beforeHash.indexOf('?');
  if (hashIndex !== -1) {
    new URLSearchParams(url.slice(hashIndex + 1)).forEach((v, k) => { params[k] = v; });
  }
  if (queryIndex !== -1) {
    new URLSearchParams(beforeHash.slice(queryIndex + 1)).forEach((v, k) => { params[k] = v; });
  }
  return params;
}

// auth is supabaseAuth.auth. Resolves once the exchange has finished (the
// session then arrives through onAuthStateChange); does nothing for any
// other URL.
export async function applyAuthDeepLink(url, auth) {
  if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return;
  const params = callbackParams(url);
  if (params.error || params.error_description) {
    console.warn('[Auth] magic link error:', params.error_description || params.error);
    return;
  }
  if (!params.code) return;
  // sb_flow_id only appears if supabase-js's experimental
  // appendPkceFlowIdToRedirects is turned on; without it the exchange reads
  // the verifier of the most recent sign-in request.
  const options = params.sb_flow_id ? { flowId: params.sb_flow_id } : undefined;
  try {
    const { error } = await auth.exchangeCodeForSession(params.code, options);
    if (error) console.warn('[Auth] magic link sign-in failed:', error.message);
  } catch (e) {
    console.warn('[Auth] magic link sign-in failed:', e?.message || e);
  }
}
