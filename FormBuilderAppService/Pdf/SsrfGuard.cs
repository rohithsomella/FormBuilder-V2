using System.Net;
using System.Net.Sockets;

namespace FormBuilderAppService.Pdf
{
    // =====================================================================================
    //  SSRF boundary
    // =====================================================================================

    /// <summary>
    /// Result of inspecting one URL. <see cref="Reason"/> is set only on a denial.
    ///
    /// <see cref="Addresses"/> carries the addresses that were actually checked. The caller
    /// is expected to connect to one of these and to nothing else - handing back the
    /// verified addresses rather than just a yes/no is what lets
    /// <see cref="SafeExternalFetcher"/> close the DNS rebinding window, because the socket
    /// then goes to the address this check approved instead of to whatever a second lookup
    /// might return.
    /// </summary>
    public readonly record struct SsrfVerdict(bool IsAllowed, string? Reason, IPAddress[]? Addresses)
    {
        public static SsrfVerdict Allow(IPAddress[] addresses) => new(true, null, addresses);

        public static SsrfVerdict Deny(string reason) => new(false, reason, null);
    }

    /// <summary>
    /// Decides whether the PDF renderer may fetch a URL.
    ///
    /// This is the security boundary for server-side request forgery. It is called from
    /// <see cref="PdfAssetProvider.ConfigureRoutingAsync"/> for every single request headless
    /// Chromium makes - the initial navigation, each hop of a redirect chain, and every
    /// iframe, image, stylesheet, script and XHR the page triggers - so there is no request
    /// shape that reaches the network without passing through here.
    ///
    /// <see cref="SafeExternalFetcher"/> is the only caller, and it is reached only once
    /// PdfRenderer:AllowExternalResources has already allowed remote fetching at all.
    /// </summary>
    public interface ISsrfGuard
    {
        ValueTask<SsrfVerdict> InspectAsync(string url, CancellationToken cancellationToken = default);
    }

    /// <summary>
    /// Allows http(s) requests to publicly routable addresses and nothing else.
    ///
    /// Three gates, in order:
    ///   1. The URL must be absolute.
    ///   2. Its scheme must be http or https. This is what keeps file://, ftp://, data: and
    ///      any other scheme from being used to read the server's own disk.
    ///   3. Every address the host resolves to must be publicly routable - all of them, not
    ///      just the first, because a name that answers with one public and one internal
    ///      address is still a way in.
    ///
    /// Everything unexpected fails closed: an unresolvable host, a resolver that times out,
    /// an empty answer and an address family that is neither IPv4 nor IPv6 are all denials.
    ///
    /// DNS rebinding is handled by never letting anyone else resolve the name a second time.
    /// The addresses this check approved come back on the verdict, and
    /// <see cref="SafeExternalFetcher"/> connects the socket straight to one of them - so
    /// there is no window in which a hostile name server can answer once for the check and
    /// differently for the connection. That only holds because the fetch happens in-process:
    /// handing the URL back to Chromium with <c>Route.ContinueAsync</c> would reopen it,
    /// since Playwright can rewrite a request's URL but not the endpoint its socket goes to.
    /// </summary>
    public sealed class SsrfGuard : ISsrfGuard
    {
        /// <summary>
        /// Cap on how long name resolution may take. Without it a host whose name server
        /// never answers would hold a render slot open until the render timeout fires.
        /// </summary>
        private static readonly TimeSpan ResolveTimeout = TimeSpan.FromSeconds(5);

        public async ValueTask<SsrfVerdict> InspectAsync(
            string url, CancellationToken cancellationToken = default)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return SsrfVerdict.Deny("the URL is not absolute");
            }

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                return SsrfVerdict.Deny($"the scheme '{uri.Scheme}' is not http or https");
            }

            // DnsSafeHost, not Host: for an IPv6 literal Host keeps the square brackets.
            var host = uri.DnsSafeHost;

            if (string.IsNullOrWhiteSpace(host))
            {
                return SsrfVerdict.Deny("the URL has no host");
            }

            IPAddress[] addresses;

            if (IPAddress.TryParse(host, out var literal))
            {
                // A literal address needs no lookup - and must not get one, or a resolver
                // failure would be the only thing standing between "http://127.0.0.1" and a
                // connection.
                addresses = new[] { literal };
            }
            else
            {
                try
                {
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    timeout.CancelAfter(ResolveTimeout);

                    addresses = await Dns.GetHostAddressesAsync(host, timeout.Token);
                }
                catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
                {
                    // Our own timeout, not the caller giving up.
                    return SsrfVerdict.Deny("the host took too long to resolve");
                }
                catch (Exception ex) when (ex is SocketException or ArgumentException)
                {
                    return SsrfVerdict.Deny("the host could not be resolved");
                }
            }

            if (addresses.Length == 0)
            {
                return SsrfVerdict.Deny("the host resolved to no addresses");
            }

            foreach (var address in addresses)
            {
                if (IsBlocked(address))
                {
                    return SsrfVerdict.Deny($"the host resolves to the non-public address {address}");
                }
            }

            return SsrfVerdict.Allow(addresses);
        }

        /// <summary>
        /// True for any address the renderer has no business connecting to.
        /// Anything that is not IPv4 or IPv6 is refused outright rather than guessed at.
        /// </summary>
        private static bool IsBlocked(IPAddress address) => address.AddressFamily switch
        {
            AddressFamily.InterNetwork => IsBlockedIPv4(address),
            AddressFamily.InterNetworkV6 => IsBlockedIPv6(address),
            _ => true
        };

        private static bool IsBlockedIPv4(IPAddress address)
        {
            var o = address.GetAddressBytes();

            return o[0] == 0                                     // 0.0.0.0/8    this network
                || o[0] == 10                                    // 10.0.0.0/8   RFC1918
                || o[0] == 127                                   // 127.0.0.0/8  loopback
                || (o[0] == 100 && o[1] >= 64 && o[1] <= 127)    // 100.64.0.0/10 carrier grade NAT
                || (o[0] == 169 && o[1] == 254)                  // 169.254.0.0/16 link-local AND cloud metadata
                || (o[0] == 172 && o[1] >= 16 && o[1] <= 31)     // 172.16.0.0/12 RFC1918
                || (o[0] == 192 && o[1] == 0 && o[2] == 0)       // 192.0.0.0/24  IETF protocol assignments
                || (o[0] == 192 && o[1] == 0 && o[2] == 2)       // 192.0.2.0/24  TEST-NET-1
                || (o[0] == 192 && o[1] == 88 && o[2] == 99)     // 192.88.99.0/24 6to4 relay anycast
                || (o[0] == 192 && o[1] == 168)                  // 192.168.0.0/16 RFC1918
                || (o[0] == 198 && (o[1] == 18 || o[1] == 19))   // 198.18.0.0/15 benchmarking
                || (o[0] == 198 && o[1] == 51 && o[2] == 100)    // 198.51.100.0/24 TEST-NET-2
                || (o[0] == 203 && o[1] == 0 && o[2] == 113)     // 203.0.113.0/24 TEST-NET-3
                || o[0] >= 224;                                  // 224/4 multicast, 240/4 reserved, 255.255.255.255
        }

        private static bool IsBlockedIPv6(IPAddress address)
        {
            // Several IPv6 forms carry an IPv4 address inside them. Judge the address they
            // actually reach, so ::ffff:127.0.0.1 cannot walk past the IPv4 rules above.
            if (TryUnwrapEmbeddedIPv4(address, out var embedded))
            {
                return IsBlockedIPv4(embedded);
            }

            if (IPAddress.IsLoopback(address)             // ::1
                || address.Equals(IPAddress.IPv6Any)      // ::
                || address.IsIPv6LinkLocal                // fe80::/10
                || address.IsIPv6SiteLocal                // fec0::/10 (deprecated)
                || address.IsIPv6UniqueLocal              // fc00::/7
                || address.IsIPv6Multicast)               // ff00::/8
            {
                return true;
            }

            var b = address.GetAddressBytes();

            // 100::/64 discard-only.
            if (b[0] == 0x01 && b[1] == 0x00
                && b[2] == 0 && b[3] == 0 && b[4] == 0 && b[5] == 0 && b[6] == 0 && b[7] == 0)
            {
                return true;
            }

            // 2001::/32 Teredo - a tunnel that terminates at an arbitrary IPv4 endpoint, so
            // the address on the wire says nothing about where the packets end up.
            if (b[0] == 0x20 && b[1] == 0x01 && b[2] == 0x00 && b[3] == 0x00)
            {
                return true;
            }

            // 2001:db8::/32 documentation range.
            if (b[0] == 0x20 && b[1] == 0x01 && b[2] == 0x0d && b[3] == 0xb8)
            {
                return true;
            }

            return false;
        }

        /// <summary>
        /// Pull the IPv4 address out of the IPv6 forms that embed one, so it can be judged by
        /// the IPv4 rules. Covers ::ffff:a.b.c.d (mapped), 2002::/16 (6to4), 64:ff9b::/96
        /// (NAT64) and the deprecated ::a.b.c.d (compatible) form.
        /// </summary>
        private static bool TryUnwrapEmbeddedIPv4(IPAddress address, out IPAddress embedded)
        {
            embedded = IPAddress.None;

            if (address.IsIPv4MappedToIPv6)
            {
                embedded = address.MapToIPv4();
                return true;
            }

            var b = address.GetAddressBytes();

            // 2002:WWXX:YYZZ::/48 - the IPv4 address sits in bytes 2..5.
            if (b[0] == 0x20 && b[1] == 0x02)
            {
                embedded = new IPAddress(new[] { b[2], b[3], b[4], b[5] });
                return true;
            }

            // 64:ff9b::/96 and 64:ff9b:1::/48 - the IPv4 address sits in the last four bytes.
            if (b[0] == 0x00 && b[1] == 0x64 && b[2] == 0xff && b[3] == 0x9b)
            {
                embedded = new IPAddress(new[] { b[12], b[13], b[14], b[15] });
                return true;
            }

            // ::a.b.c.d - deprecated, but still routed. Exclude :: and ::1, which are handled
            // as IPv6 addresses in their own right.
            var first12AreZero = true;
            for (var i = 0; i < 12; i++)
            {
                if (b[i] != 0)
                {
                    first12AreZero = false;
                    break;
                }
            }

            if (first12AreZero && !(b[12] == 0 && b[13] == 0 && b[14] == 0 && b[15] <= 1))
            {
                embedded = new IPAddress(new[] { b[12], b[13], b[14], b[15] });
                return true;
            }

            return false;
        }
    }
}
