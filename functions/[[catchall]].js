export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    let htmlFile = '/index.html';
    const parts = path.split('/').filter(Boolean);
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last === 'editor') htmlFile = '/editor.html';
        else if (last === 'fullscreen') htmlFile = '/fullscreen.html';
        else if (last === 'embed') htmlFile = '/embed.html';
        else if (parts[0] === 'addons') htmlFile = '/addons.html';
        else if (parts[0] === 'credits') htmlFile = '/credits.html';
    }

    const candidates = [htmlFile, '/index.html', '/'];
    for (const candidate of candidates) {
        try {
            const resp = await env.ASSETS.fetch(new Request(new URL(candidate, url.origin)));
            if (resp.status === 200 && resp.body) {
                return new Response(resp.body, {
                    status: 200,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }
            if (resp.status >= 300 && resp.status < 400) {
                const loc = resp.headers.get('location');
                if (loc) {
                    const followed = await env.ASSETS.fetch(new Request(new URL(loc, url.origin)));
                    if (followed.status === 200 && followed.body) {
                        return new Response(followed.body, {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        });
                    }
                }
            }
        } catch (e) {
            // continue to next candidate
        }
    }

    return new Response('Page not found', { status: 404 });
}
