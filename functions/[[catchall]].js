export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    return env.ASSETS.fetch(new Request(new URL('/index.html', url.origin), request));
}
