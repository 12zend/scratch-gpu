export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    const fetchAsset = async (target) => {
        const reqInit = {
            method: request.method,
            headers: request.headers
        };
        let resp = await env.ASSETS.fetch(new Request(new URL(target, url.origin), reqInit));
        let hops = 0;
        while (resp.status >= 300 && resp.status < 400 && hops < 5) {
            const loc = resp.headers.get('location');
            if (!loc) break;
            hops++;
            const target2 = loc.startsWith('/') ? loc : new URL(loc, url.origin).pathname;
            resp = await env.ASSETS.fetch(new Request(new URL(target2, url.origin), reqInit));
        }
        return resp;
    };

    const parts = path.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1] || '';
    const hasExtension = /\.\w+$/.test(lastPart);

    if (hasExtension) {
        return fetchAsset(path);
    }

    let htmlFile = '/index.html';
    if (parts.length > 0) {
        if (lastPart === 'editor') htmlFile = '/editor.html';
        else if (lastPart === 'fullscreen') htmlFile = '/fullscreen.html';
        else if (lastPart === 'embed') htmlFile = '/embed.html';
        else if (parts[0] === 'addons') htmlFile = '/addons.html';
        else if (parts[0] === 'credits') htmlFile = '/credits.html';
    }

    const resp = await fetchAsset(htmlFile);
    const body = resp.body;
    return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
}
