import { useMemo } from 'react';

export default function SandboxPreview({ html, css, js, bare = false, height = 320 }: { html?: string; css?: string; js?: string; bare?: boolean; height?: number | string }) {
  const srcDoc = useMemo(() => buildSrcDoc(html, css, js), [html, css, js]);
  const heightStyle = typeof height === 'string' ? { height } : { height: `${height}px` };

  if (bare) {
    return (
      <iframe
        title="html-sandbox-preview"
        className="w-full bg-black/20 rounded-md border border-[var(--border)]"
        style={heightStyle}
        sandbox="allow-scripts allow-same-origin allow-modals"
        srcDoc={srcDoc}
      />
    );
  }
  return (
    <div className="card p-0 overflow-hidden">
      <div className="px-3 py-2 text-xs text-textDim border-b border-[var(--border)]">Live Preview (sandboxed)</div>
      <iframe
        title="html-sandbox-preview"
        className="w-full bg-black/20"
        style={heightStyle}
        sandbox="allow-scripts allow-same-origin allow-modals"
        srcDoc={srcDoc}
      />
    </div>
  );
}

function buildSrcDoc(html?: string, css?: string, js?: string): string {
  const safeHtml = String(html || '');
  const safeCss = String(css || '');
  const safeJs = String(js || '');
  // Inline basic runtime: prevent fetch/XHR/websocket by overriding but allow more functionality
  const guardJs = `
    (function(){
      const block = (name) => { console.warn(name + ' blocked in sandbox'); throw new Error(name+' blocked'); };
      // Only block network requests, allow other APIs
      window.fetch = (...a)=>{ block('fetch'); };
      window.XMLHttpRequest = function(){ block('XMLHttpRequest'); };
      window.WebSocket = function(){ block('WebSocket'); };
      // Allow longer timers for games and animations
      const _setTimeout = window.setTimeout; window.setTimeout = (fn, ms)=>_setTimeout(fn, Math.min(10000, ms||0));
      const _setInterval = window.setInterval; window.setInterval = (fn, ms)=>_setInterval(fn, Math.min(10000, ms||0));
      // Console proxy
      console.log = (...args)=>{ parent?.postMessage({ type:'sandbox-log', args }, '*'); };
      console.error = (...args)=>{ parent?.postMessage({ type:'sandbox-error', args }, '*'); };
      console.warn = (...args)=>{ parent?.postMessage({ type:'sandbox-warn', args }, '*'); };
    })();
  `;
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; connect-src 'none';" />
      <style>
        html, body { margin:0; padding:0; box-sizing: border-box; }
        *, *::before, *::after { box-sizing: inherit; }
        body { background: #0b0f13; color: #e6edf3; font-family: system-ui, -apple-system, sans-serif; }
        ${safeCss}
      </style>
    </head>
    <body>
      ${safeHtml}
      <script>${guardJs}\n${safeJs}<\/script>
    </body>
  </html>`;
}


