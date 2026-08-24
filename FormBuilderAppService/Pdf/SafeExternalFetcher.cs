using System.Net;
using System.Net.Security;
using System.Net.Sockets;

namespace FormBuilderAppService.Pdf
{
    // =====================================================================================
    //  External resource loading
    // =====================================================================================

    /// <summary>What the renderer should do with one external request.</summary>
    public sealed class SafeFetchResult
    {
        public bool IsAllowed { get; init; }

        /// <summary>Why the request was refused. Set only when <see cref="IsAllowed"/> is false.</summary>
        public string? Reason { get; init; }

        public int Status { get; init; }

        public string? ContentType { get; init; }

        public byte[] Body { get; init; } = Array.Empty<byte>();

        public Dictionary<string, string> Headers { get; init; } = new();

        public static SafeFetchResult Blocked(string reason) => new() { IsAllowed = false, Reason = reason };
    }

    public interface ISafeExternalFetcher
    {
        Task<SafeFetchResult> FetchAsync(
            string url,
            string method,
            IReadOnlyDictionary<string, string> requestHeaders,
            byte[]? body,
            CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Fetches the external resources a rendered page asks for, instead of letting Chromium
    /// fetch them itself.
    ///
    /// Why in-process rather than <c>Route.ContinueAsync</c>: Playwright's route handler is
    /// invoked once per request, and when a continued request comes back as a 30x, Chromium
    /// follows the redirect through its own network stack WITHOUT routing the new URL past
    /// the handler again. That is measurable, not theoretical - a handler that aborts the
    /// redirect target never runs, and the request still reaches the server. So a check
    /// wired into ContinueAsync validates the first URL of a chain and nothing after it,
    /// which is exactly the hole an attacker needs: publish a public URL that redirects to
    /// 169.254.169.254 and the renderer walks straight into it.
    ///
    /// Doing the fetch here fixes that and one more thing. Every hop is checked before it is
    /// taken, and each connection is opened directly to an address the check already
    /// approved (see the ConnectCallback below), so the name is never resolved a second time
    /// and DNS rebinding has no window to work in.
    ///
    /// The bytes are then handed back to the page through <c>Route.FulfillAsync</c>, so the
    /// page sees an ordinary response and rendering is unchanged.
    /// </summary>
    public sealed class SafeExternalFetcher : ISafeExternalFetcher, IDisposable
    {
        /// <summary>A legitimate resource does not need more hops than this.</summary>
        private const int MaxRedirects = 5;

        /// <summary>
        /// Ceiling on a single resource. Chromium would have streamed the body; we hold it in
        /// memory, so it needs a bound - a hostile URL should not be able to exhaust the
        /// server by pointing at something enormous.
        /// </summary>
        private const int MaxResponseBytes = 16 * 1024 * 1024;

        /// <summary>
        /// The addresses <see cref="ISsrfGuard"/> approved for this request. The connect
        /// callback will use these and refuse to connect without them.
        /// </summary>
        private static readonly HttpRequestOptionsKey<IPAddress[]> ApprovedAddresses = new("PdfApprovedAddresses");

        /// <summary>Headers that belong to the browser's hop and must not be replayed.</summary>
        private static readonly HashSet<string> SkippedRequestHeaders = new(StringComparer.OrdinalIgnoreCase)
        {
            "host", "connection", "content-length", "transfer-encoding", "keep-alive",
            "upgrade", "proxy-connection", "te", "trailer",

            // Deliberately not forwarded to a third party host, whatever the page asked for.
            "cookie", "authorization", "proxy-authorization"
        };

        /// <summary>
        /// Response headers that describe the transfer rather than the content. The body
        /// handed back has already been decompressed and re-framed, so replaying these would
        /// describe it wrongly.
        /// </summary>
        private static readonly HashSet<string> SkippedResponseHeaders = new(StringComparer.OrdinalIgnoreCase)
        {
            "content-length", "content-encoding", "transfer-encoding", "connection",
            "keep-alive", "upgrade", "trailer", "set-cookie", "set-cookie2"
        };

        private readonly ISsrfGuard _guard;
        private readonly ILogger<SafeExternalFetcher> _logger;
        private readonly HttpClient _client;

        public SafeExternalFetcher(ISsrfGuard guard, ILogger<SafeExternalFetcher> logger)
        {
            _guard = guard;
            _logger = logger;

            var handler = new SocketsHttpHandler
            {
                // Redirects are followed by hand, one validated hop at a time.
                AllowAutoRedirect = false,

                AutomaticDecompression = DecompressionMethods.All,
                ConnectTimeout = TimeSpan.FromSeconds(10),

                // Matches BrowserNewContextOptions.IgnoreHTTPSErrors on the render context.
                // Rendering a page whose certificate is imperfect is a pre-existing decision
                // of this engine; moving the fetch here must not quietly change what renders.
                SslOptions = new SslClientAuthenticationOptions
                {
                    RemoteCertificateValidationCallback = (_, _, _, _) => true
                },

                // The one place a socket is opened. It connects only to an address the guard
                // approved for this specific request, and it does not resolve anything
                // itself - that is what makes the check and the connection agree.
                ConnectCallback = async (context, cancellationToken) =>
                {
                    if (!context.InitialRequestMessage.Options.TryGetValue(ApprovedAddresses, out var approved)
                        || approved is null || approved.Length == 0)
                    {
                        throw new InvalidOperationException(
                            "Refusing to connect: no address was approved for this request.");
                    }

                    Exception? lastFailure = null;

                    foreach (var address in approved)
                    {
                        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };

                        try
                        {
                            await socket.ConnectAsync(
                                new IPEndPoint(address, context.DnsEndPoint.Port), cancellationToken);

                            return new NetworkStream(socket, ownsSocket: true);
                        }
                        catch (Exception ex)
                        {
                            socket.Dispose();
                            lastFailure = ex;
                        }
                    }

                    throw lastFailure ?? new IOException("No approved address accepted the connection.");
                }
            };

            _client = new HttpClient(handler)
            {
                Timeout = TimeSpan.FromSeconds(20)
            };
        }

        public async Task<SafeFetchResult> FetchAsync(
            string url,
            string method,
            IReadOnlyDictionary<string, string> requestHeaders,
            byte[]? body,
            CancellationToken cancellationToken = default)
        {
            var currentUrl = url;

            for (var hop = 0; hop <= MaxRedirects; hop++)
            {
                // Checked before every hop, including the ones a server asked for. This loop
                // is the whole reason the fetch lives here.
                var verdict = await _guard.InspectAsync(currentUrl, cancellationToken);

                if (!verdict.IsAllowed)
                {
                    var reason = verdict.Reason ?? "the address is not allowed";

                    // Name the hop when it is not the URL the page asked for, or the log line
                    // reads as though the original URL resolved somewhere it never did.
                    return SafeFetchResult.Blocked(hop == 0
                        ? reason
                        : $"it redirected to {currentUrl}, which was refused because {reason}");
                }

                HttpResponseMessage response;

                try
                {
                    using var request = BuildRequest(
                        currentUrl,
                        // Only the original request keeps its method and body; a redirect is
                        // followed as a GET, which is what a browser does for 301/302/303.
                        hop == 0 ? method : "GET",
                        hop == 0 ? requestHeaders : null,
                        hop == 0 ? body : null,
                        verdict.Addresses!);

                    response = await _client.SendAsync(
                        request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                }
                catch (Exception ex) when (ex is HttpRequestException or IOException or SocketException
                                               or InvalidOperationException)
                {
                    _logger.LogDebug(ex, "External PDF resource could not be fetched: {Url}", currentUrl);
                    return SafeFetchResult.Blocked("the resource could not be fetched");
                }
                catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    return SafeFetchResult.Blocked("the resource timed out");
                }

                using (response)
                {
                    if (IsRedirect(response.StatusCode) && response.Headers.Location is not null)
                    {
                        // Relative Location values are legal, so resolve against the URL that
                        // produced them before the next pass checks it.
                        if (!Uri.TryCreate(new Uri(currentUrl), response.Headers.Location, out var next))
                        {
                            return SafeFetchResult.Blocked("the redirect target could not be parsed");
                        }

                        _logger.LogDebug(
                            "External PDF resource redirect {From} -> {To}", currentUrl, next);

                        currentUrl = next.ToString();
                        continue;
                    }

                    return await ReadResultAsync(response, cancellationToken);
                }
            }

            return SafeFetchResult.Blocked($"the resource redirected more than {MaxRedirects} times");
        }

        private static HttpRequestMessage BuildRequest(
            string url,
            string method,
            IReadOnlyDictionary<string, string>? headers,
            byte[]? body,
            IPAddress[] approvedAddresses)
        {
            var request = new HttpRequestMessage(new HttpMethod(method), url);
            request.Options.Set(ApprovedAddresses, approvedAddresses);

            if (body is { Length: > 0 })
            {
                request.Content = new ByteArrayContent(body);
            }

            if (headers is null)
            {
                return request;
            }

            foreach (var (name, value) in headers)
            {
                if (SkippedRequestHeaders.Contains(name))
                {
                    continue;
                }

                if (!request.Headers.TryAddWithoutValidation(name, value))
                {
                    request.Content?.Headers.TryAddWithoutValidation(name, value);
                }
            }

            return request;
        }

        private static async Task<SafeFetchResult> ReadResultAsync(
            HttpResponseMessage response, CancellationToken cancellationToken)
        {
            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var buffer = new MemoryStream();

            var chunk = new byte[81920];
            int read;

            while ((read = await stream.ReadAsync(chunk, cancellationToken)) > 0)
            {
                if (buffer.Length + read > MaxResponseBytes)
                {
                    return SafeFetchResult.Blocked("the resource is larger than the renderer accepts");
                }

                buffer.Write(chunk, 0, read);
            }

            var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            foreach (var header in response.Headers.Concat<KeyValuePair<string, IEnumerable<string>>>(
                         response.Content.Headers))
            {
                if (SkippedResponseHeaders.Contains(header.Key))
                {
                    continue;
                }

                headers[header.Key] = string.Join(", ", header.Value);
            }

            return new SafeFetchResult
            {
                IsAllowed = true,
                Status = (int)response.StatusCode,
                ContentType = response.Content.Headers.ContentType?.ToString(),
                Body = buffer.ToArray(),
                Headers = headers
            };
        }

        private static bool IsRedirect(HttpStatusCode status) => status is
            HttpStatusCode.MovedPermanently or      // 301
            HttpStatusCode.Found or                 // 302
            HttpStatusCode.SeeOther or              // 303
            HttpStatusCode.TemporaryRedirect or     // 307
            HttpStatusCode.PermanentRedirect;       // 308

        public void Dispose() => _client.Dispose();
    }
}
