# Reverse proxy and HTTPS

To play with people outside your network, serve OpenVTT over HTTPS through a reverse proxy. Requirements, whichever proxy you use:

1. **HTTPS**, with `OPENVTT_SECURE_COOKIES=1` set on the OpenVTT container or process.
2. **WebSocket upgrades on `/ws`**, because the table is live over `ws(s)://host/ws?world=<id>`.
3. **Large request bodies and long timeouts** for map uploads: at least the video limit (`OPENVTT_MAX_VIDEO_BYTES`, 100 MiB by default) and no request buffering.
4. Forward to port 3000 of OpenVTT. A health check is available at `/healthz`.

Replace `vtt.example.com` below with your domain. When the proxy runs on the same host, bind OpenVTT to localhost (`HOST=127.0.0.1`, or publish `127.0.0.1:3000:3000` in Docker).

## Rate limits

Login (60 per minute), world and scene export (30 per minute) and world import (10 per minute) are rate limited per client IP, and over the limit the server answers `429`. OpenVTT does not trust `X-Forwarded-For`, so behind a proxy every user shares the proxy's address and therefore one limit. The numbers are generous for a normal table; if a large group signs in at once and hits them, wait a minute.

## Caddy

Caddy gets certificates automatically and handles WebSockets without extra setup.

```caddyfile
vtt.example.com {
    request_body {
        max_size 110MB
    }
    reverse_proxy 127.0.0.1:3000
}
```

## nginx

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    http2 on;
    server_name vtt.example.com;
    # ssl_certificate / ssl_certificate_key: for example from certbot

    client_max_body_size 110m;
    proxy_request_buffering off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 3600s;   # idle WebSocket connections
    }
}
```

## Traefik

With the Docker provider, labels on the `openvtt` service (adjust the entrypoint and resolver names to your setup):

```yaml
services:
  openvtt:
    build: .
    environment:
      OPENVTT_SECURE_COOKIES: "1"
    volumes:
      - openvtt-data:/data
    labels:
      - traefik.enable=true
      - traefik.http.routers.openvtt.rule=Host(`vtt.example.com`)
      - traefik.http.routers.openvtt.entrypoints=websecure
      - traefik.http.routers.openvtt.tls.certresolver=letsencrypt
      - traefik.http.services.openvtt.loadbalancer.server.port=3000
volumes:
  openvtt-data:
```

Traefik forwards WebSocket upgrades by default. For Dokploy, use `compose.dokploy.yaml` and the Domains tab; see the [README](../README.md#behind-dokploy-traefik).

## Cloudflare Tunnel and similar

Tunnels work, but check that WebSockets are enabled and that the upload size limit of the plan covers your largest map.

## Verifying

- `curl -i https://vtt.example.com/healthz` returns `200` and `{"ok":true}`.
- In the browser, the table shows "Connecting…" briefly and then the world. If it stays on "Connection lost, reconnecting…", the proxy is not forwarding `/ws`: see [troubleshooting](troubleshooting.md).
