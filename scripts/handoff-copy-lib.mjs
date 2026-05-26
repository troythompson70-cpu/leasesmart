/**
 * LeaseSmart — Copy for Claude handoff HTML (Sprint B2+)
 * Generates a Mac-friendly one-click copy button for every handoff block.
 */
export const HANDOFF_START = '--- CLAUDE HANDOFF START ---';
export const HANDOFF_END = '--- CLAUDE HANDOFF END ---';

export function wrapHandoffBlock(body) {
  return [HANDOFF_START, String(body || '').trim(), HANDOFF_END].join('\n');
}

export function handoffCopyButtonHtml(handoffText, opts) {
  opts = opts || {};
  const id = opts.id || 'lsHandoffBlock';
  const safe = String(handoffText || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return [
    '<div class="ls-handoff-wrap">',
    '  <pre class="ls-handoff-pre" id="' + id + '">' + safe + '</pre>',
    '  <button type="button" class="ls-copy-for-claude-btn" data-handoff-target="' + id + '" onclick="lsCopyHandoffForClaude(this)">Copy for Claude</button>',
    '  <span class="ls-copy-for-claude-status" aria-live="polite"></span>',
    '</div>',
  ].join('\n');
}

export function handoffCopyStyles() {
  return [
    '.ls-handoff-wrap{margin:24px 0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}',
    '.ls-handoff-pre{background:#f8fafb;border:2px solid #e5e7eb;border-radius:12px;padding:18px;font-size:13px;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:480px;overflow:auto}',
    '.ls-copy-for-claude-btn{display:block;width:100%;max-width:420px;margin:16px auto 0;padding:18px 28px;font-size:20px;font-weight:800;color:#000;background:linear-gradient(135deg,#22d98a,#0ea060);border:none;border-radius:14px;cursor:pointer;box-shadow:0 6px 20px rgba(34,217,138,.35);letter-spacing:.2px}',
    '.ls-copy-for-claude-btn:hover{filter:brightness(1.05)}',
    '.ls-copy-for-claude-btn:active{transform:scale(.98)}',
    '.ls-copy-for-claude-status{display:block;text-align:center;margin-top:10px;font-size:14px;font-weight:700;color:#16a34a;min-height:20px}',
  ].join('\n');
}

export function handoffCopyScript() {
  return [
    'function lsCopyHandoffForClaude(btn){',
    '  var id=btn.getAttribute("data-handoff-target");',
    '  var el=document.getElementById(id);',
    '  var status=btn.parentElement.querySelector(".ls-copy-for-claude-status");',
    '  if(!el){if(status)status.textContent="Handoff block not found.";return;}',
    '  var text=el.textContent||el.innerText||"";',
    '  function ok(){if(status){status.textContent="Copied! Paste into Claude.";setTimeout(function(){status.textContent="";},3000);}}',
    '  function fail(){if(status){status.textContent="Copy failed — select the block manually.";}}',
    '  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(ok).catch(fail);}',
    '  else{try{var ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.left="-9999px";document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);ok();}catch(e){fail();}}',
    '}',
  ].join('\n');
}

export function handoffReportHtml(title, handoffBody, opts) {
  opts = opts || {};
  const handoff = wrapHandoffBlock(handoffBody);
  return [
    '<!DOCTYPE html>',
    '<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
    '<title>' + (title || 'LeaseSmart Handoff') + '</title>',
    '<style>' + handoffCopyStyles() + '</style>',
    '</head><body style="max-width:900px;margin:0 auto;padding:24px 18px;color:#111827">',
    '<h1 style="font-size:22px;margin-bottom:8px">' + (title || 'LeaseSmart Sprint Handoff') + '</h1>',
    '<p style="color:#6b7280;font-size:14px;margin-bottom:20px">TGT Technologies Inc. — click <strong>Copy for Claude</strong> below.</p>',
    handoffCopyButtonHtml(handoff, opts),
    '<script>' + handoffCopyScript() + '</script>',
    '</body></html>',
  ].join('\n');
}
