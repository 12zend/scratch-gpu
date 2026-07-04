export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    const fetchAsset = async (target) => {
        const resp = await env.ASSETS.fetch(new Request(new URL(target, url.origin), request));
        if (resp.status >= 300 && resp.status < 400) {
            const loc = resp.headers.get('location');
            if (loc) {
                return env.ASSETS.fetch(new Request(new URL(loc, url.origin)));
            }
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
