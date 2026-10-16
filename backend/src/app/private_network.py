"""Let a public page call this API when the browser resolves it to a private IP.

GitHub Pages is a public origin. On a machine in the tailnet, the Funnel
hostname resolves to a Tailscale address, and Firefox treats that as a
private-network request. Without this header it reports those calls as CORS
failures. Browsers off the tailnet use the public Funnel address and ignore it.
"""


class PrivateNetworkAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Access-Control-Allow-Private-Network"] = "true"
        # Django's default same-origin opener policy makes Firefox treat
        # cross-origin API responses as network failures. The page then
        # drops the token and shows the sign-in form again.
        if "Cross-Origin-Opener-Policy" in response:
            del response["Cross-Origin-Opener-Policy"]
        return response
