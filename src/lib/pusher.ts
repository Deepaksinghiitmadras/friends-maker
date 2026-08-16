import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

const CLUSTER = 'us3';

declare global {
    var pusherServerInstance: PusherServer | undefined;
    var pusherClientInstance: PusherClient | undefined;
}

// ─── Server-side Pusher instance ──────────────────────────────────────────────
// Always safe to instantiate in Node.js runtime.
if (!global.pusherServerInstance) {
    global.pusherServerInstance = new PusherServer({
        appId: process.env.PUSHER_APP_ID!,
        key: process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
        secret: process.env.PUSHER_SECRET!,
        cluster: CLUSTER,
        useTLS: true,
    });
}

export const pusherServer = global.pusherServerInstance!;

// ─── Client-side Pusher instance ──────────────────────────────────────────────
// PusherClient is safe to import and instantiate on the server at build time
// as long as we pass a placeholder key. The actual client used in browser
// components is the global singleton re-used from `window`.
if (!global.pusherClientInstance) {
    // Safe: PusherClient constructor does not make live network connections
    // until a channel is subscribed. Using NEXT_PUBLIC key (available at build time).
    global.pusherClientInstance = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_APP_KEY ?? 'placeholder',
        {
            cluster: CLUSTER,
            channelAuthorization: {
                endpoint: '/api/pusher-auth',
                transport: 'ajax',
            },
        },
    );
}

export const pusherClient = global.pusherClientInstance!;