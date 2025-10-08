const entities = require('@jetbrains/youtrack-scripting-api/entities');
const workflow = require('@jetbrains/youtrack-scripting-api/workflow');

const APP_ID = workflow.requireString('GITHUB_APP_ID');
const GITHUB_REPO = workflow.requireString('GITHUB_REPO');
const APP_PRIVATE_KEY_PEM_RAW = (workflow.requirePassword
  ? workflow.requirePassword('GITHUB_APP_PRIVATE_KEY_PEM')
  : workflow.requireString('GITHUB_APP_PRIVATE_KEY_PEM'));
const APP_PRIVATE_KEY_PEM = APP_PRIVATE_KEY_PEM_RAW.indexOf('\\n') >= 0
  ? APP_PRIVATE_KEY_PEM_RAW.replace(/\\n/g, '\n')
  : APP_PRIVATE_KEY_PEM_RAW;

exports.rule = entities.Issue.onChange({
  title: 'Test-GitHub-App-RS256',
  guard: (ctx) => ctx.issue.tags.added.has(ctx.devBotTag),
  action: (ctx) => {
    const http = require('v1/http');

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = { iat: now - 60, exp: now + 9 * 60, iss: String(APP_ID) };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    const signingInput = encodedHeader + '.' + encodedPayload;

    let jwt = null;
    const tried = [];

    // Attempt to locate an RS256 signer in the YouTrack runtime
    try {
      const crypto = require('v1/crypto');

      if (typeof crypto.sign === 'function') {
        tried.push('crypto.sign("RSA-SHA256")');
        try {
          const sig = crypto.sign('RSA-SHA256', signingInput, APP_PRIVATE_KEY_PEM);
          jwt = assembleJwt(signingInput, sig);
        } catch (e) { console.log('crypto.sign failed:', e.message); }
      }
      if (!jwt && typeof crypto.rsaSign === 'function') {
        tried.push('crypto.rsaSign("SHA-256")');
        try {
          const sig = crypto.rsaSign('SHA-256', signingInput, APP_PRIVATE_KEY_PEM);
          jwt = assembleJwt(signingInput, sig);
        } catch (e) { console.log('crypto.rsaSign failed:', e.message); }
      }
      if (!jwt && typeof crypto.signRS256 === 'function') {
        tried.push('crypto.signRS256');
        try {
          const sig = crypto.signRS256(signingInput, APP_PRIVATE_KEY_PEM);
          jwt = assembleJwt(signingInput, sig);
        } catch (e) { console.log('crypto.signRS256 failed:', e.message); }
      }
    } catch (e) {
      console.log('v1/crypto unavailable:', e.message);
    }

    if (!jwt) {
      console.log('RS256 signer not available. Tried:', tried.join(' | ') || 'no crypto module');
      console.log('Conclusion: Plan A not supported in this runtime.');
      return;
    }

    // Verify the JWT by resolving the GitHub App installation for the repo
    try {
      const conn = new http.Connection('https://api.github.com');
      conn.addHeader('Accept', 'application/vnd.github+json');
      conn.addHeader('Authorization', 'Bearer ' + jwt);
      // conn.addHeader('X-GitHub-Api-Version', '2022-11-28'); // optional

      const res = conn.getSync('/repos/' + GITHUB_REPO + '/installation');

      if (res && res.isSuccess) {
        console.log('Installation lookup succeeded. Status:', res.status);
        console.log('Plan A appears feasible from this environment.');
      } else {
        console.log('Installation lookup failed. Status:', res && res.status);
        console.log('Response:', res && res.response);
        console.log('JWT likely not accepted; Plan A likely not feasible.');
      }
    } catch (e) {
      console.error('GitHub call error:', e.message);
    }
  },
  requirements: {
    devBotTag: { type: entities.Tag, name: 'dev-bot' }
  }
});

// ----- Utils -----
function assembleJwt(signingInput, signature) {
  if (typeof signature === 'string') {
    return signingInput + '.' + b64ToB64Url(signature);
  }
  return signingInput + '.' + base64urlBytes(signature);
}

function base64url(str) { return b64ToB64Url(base64Encode(utf8ToBytes(str))); }
function base64urlBytes(bytes) { return b64ToB64Url(base64Encode(bytes)); }
function b64ToB64Url(b64) { return b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }

function utf8ToBytes(str) {
  const encoded = encodeURIComponent(str);
  const bytes = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') { bytes.push(parseInt(encoded.substr(i + 1, 2), 16)); i += 2; }
    else { bytes.push(encoded.charCodeAt(i)); }
  }
  return bytes;
}

function base64Encode(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] | 0;
    const b1 = (i + 1 < bytes.length) ? bytes[i + 1] : undefined;
    const b2 = (i + 2 < bytes.length) ? bytes[i + 2] : undefined;

    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 !== undefined ? (b1 >> 4) & 0x0f : 0)];

    if (b1 === undefined) {
      out += '==';
      break;
    }
    out += chars[((b1 & 0x0f) << 2) | (b2 !== undefined ? (b2 >> 6) & 0x03 : 0)];

    if (b2 === undefined) {
      out += '=';
      break;
    }
    out += chars[b2 & 0x3f];
  }
  return out;
}

