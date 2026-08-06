using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using Microsoft.Playwright;

namespace FormBuilderAppService.Pdf
{
    // =====================================================================================
    //  Browser lifetime
    // =====================================================================================

    /// <summary>
    /// Starts Chromium once and keeps it alive for the lifetime of the process,
    /// relaunching automatically if the browser dies.
    /// </summary>
    public sealed class PlaywrightBrowserProvider : IPlaywrightBrowserProvider
    {
        private readonly PdfRendererSettings _settings;
        private readonly ILogger<PlaywrightBrowserProvider> _logger;
        private readonly SemaphoreSlim _lock = new(1, 1);

        /// <summary>Never let a hung Chromium block the relaunch.</summary>
        private static readonly TimeSpan CloseTimeout = TimeSpan.FromSeconds(10);

        private IPlaywright? _playwright;

        // Written from Chromium's Disconnected callback as well as from inside the lock,
        // and read outside it in the fast path.
        private volatile IBrowser? _browser;

        private bool _disposed;

        public PlaywrightBrowserProvider(
            IOptions<PdfRendererSettings> settings,
            ILogger<PlaywrightBrowserProvider> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        public string? BrowserVersion => _browser?.Version;

        public async Task<IBrowser> GetBrowserAsync(CancellationToken cancellationToken = default)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);

            if (_browser is { IsConnected: true })
            {
                return _browser;
            }

            await _lock.WaitAsync(cancellationToken);
            try
            {
                if (_browser is { IsConnected: true })
                {
                    return _browser;
                }

                if (_browser != null)
                {
                    _logger.LogWarning("Chromium disconnected - relaunching");
                    await SafeCloseBrowserAsync();
                }

                _playwright ??= await Playwright.CreateAsync();

                var browser = await LaunchAsync();

                // Chromium can die at any time (crash, OOM killer, an operator killing the
                // process). Clearing the field on that event is all the recovery that is
                // needed: the next GetBrowserAsync sees no browser and launches a new one.
                browser.Disconnected += OnBrowserDisconnected;
                _browser = browser;

                _logger.LogInformation("Chromium launched for PDF rendering. Version: {Version}", browser.Version);
                return browser;
            }
            finally
            {
                _lock.Release();
            }
        }

        /// <summary>
        /// Drop a dead browser so the next request relaunches it. A browser that is still
        /// connected is deliberately left alone - either the failure was not the browser's
        /// fault, or another request has already replaced it and closing it here would kill
        /// renders that are still in flight.
        /// </summary>
        public async Task InvalidateAsync(Exception? reason = null)
        {
            if (_disposed)
            {
                return;
            }

            await _lock.WaitAsync();
            try
            {
                if (_browser is null or { IsConnected: true })
                {
                    return;
                }

                _logger.LogWarning(reason,
                    "Discarding the crashed Chromium instance - the next PDF request will relaunch it");

                await SafeCloseBrowserAsync();
            }
            finally
            {
                _lock.Release();
            }
        }

        private void OnBrowserDisconnected(object? sender, IBrowser browser)
        {
            // Guard with a reference check so a late event from an already replaced browser
            // cannot clear the current one.
            if (!ReferenceEquals(_browser, browser))
            {
                return;
            }

            _browser = null;
            _logger.LogWarning("Chromium disconnected unexpectedly - it will be relaunched on the next PDF request");
        }

        private async Task<IBrowser> LaunchAsync()
        {
            var launchOptions = new BrowserTypeLaunchOptions
            {
                Headless = _settings.Headless,
                Args = _settings.BrowserArgs,
                Timeout = Math.Max(1, _settings.BrowserLaunchTimeoutSeconds) * 1000f
            };

            try
            {
                return await _playwright!.Chromium.LaunchAsync(launchOptions);
            }
            catch (PlaywrightException ex) when (_settings.AutoInstallBrowser && IsBrowserMissing(ex))
            {
                _logger.LogWarning("Chromium is not installed for Playwright - downloading it now. {Message}", ex.Message);

                var exitCode = Microsoft.Playwright.Program.Main(new[] { "install", "chromium" });
                if (exitCode != 0)
                {
                    throw new InvalidOperationException(
                        $"Automatic Chromium install failed with exit code {exitCode}. " +
                        "Run 'pwsh bin/Debug/net8.0/playwright.ps1 install chromium' manually.", ex);
                }

                return await _playwright!.Chromium.LaunchAsync(launchOptions);
            }
        }

        private static bool IsBrowserMissing(PlaywrightException ex) =>
            ex.Message.Contains("Executable doesn't exist", StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("playwright install", StringComparison.OrdinalIgnoreCase);

        private async Task SafeCloseBrowserAsync()
        {
            var browser = _browser;
            _browser = null;

            if (browser == null)
            {
                return;
            }

            browser.Disconnected -= OnBrowserDisconnected;

            try
            {
                // A crashed browser can hang in Close; the relaunch must not wait on it.
                await browser.CloseAsync().WaitAsync(CloseTimeout);
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Ignoring error while closing Chromium");
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (_disposed)
            {
                return;
            }

            _disposed = true;
            await SafeCloseBrowserAsync();
            _playwright?.Dispose();
            _playwright = null;
            _lock.Dispose();
        }
    }

    // =====================================================================================
    //  Asset delivery
    // =====================================================================================

    /// <summary>
    /// Serves the render harness and all frontend rendering assets to headless Chromium by
    /// intercepting its requests and answering them from disk.
    ///
    /// Development : assets come from ../FormBuilderJs (a frontend rebuild is picked up
    ///               immediately, no copying).
    /// Production  : assets come from wwwroot/pdf, which the publish target fills, so the API
    ///               never depends on the frontend project being present.
    /// </summary>
    public sealed class PdfAssetProvider : IPdfAssetProvider
    {
        private const string EnginePrefix = "/engine/";
        private const string DistPrefix = "/dist/";
        private const string AppPrefix = "/app/";
        private const string HarnessFile = "render.html";

        private static readonly FileExtensionContentTypeProvider ContentTypes = new();

        private readonly PdfRendererSettings _settings;
        private readonly ILogger<PdfAssetProvider> _logger;

        public PdfAssetProvider(
            IOptions<PdfRendererSettings> settings,
            IHostEnvironment environment,
            ILogger<PdfAssetProvider> logger)
        {
            _settings = settings.Value;
            _logger = logger;

            AssetsRoot = ResolveRoot(environment.ContentRootPath, _settings.AssetsPath);
            AppAssetsRoot = ResolveRoot(environment.ContentRootPath, _settings.AppAssetsPath);
            EngineRoot = ResolveRoot(environment.ContentRootPath, _settings.EnginePath);

            BaseUrl = $"http://{_settings.VirtualHost}";
            HarnessUrl = $"{BaseUrl}{EnginePrefix}{HarnessFile}";

            _logger.LogInformation(
                "PDF renderer assets [{Mode}] dist={Assets} app={AppAssets} engine={Engine}",
                _settings.Mode, AssetsRoot, AppAssetsRoot, EngineRoot);
        }

        public string BaseUrl { get; }

        public string HarnessUrl { get; }

        public string AssetsRoot { get; }

        public string AppAssetsRoot { get; }

        public string EngineRoot { get; }

        public Task ConfigureRoutingAsync(IPage page) => page.RouteAsync("**/*", HandleRouteAsync);

        private async Task HandleRouteAsync(IRoute route)
        {
            try
            {
                if (!Uri.TryCreate(route.Request.Url, UriKind.Absolute, out var uri))
                {
                    await route.AbortAsync();
                    return;
                }

                if (!string.Equals(uri.Host, _settings.VirtualHost, StringComparison.OrdinalIgnoreCase))
                {
                    // Anything not served from disk, for example an image stored on a CDN.
                    var isWeb = uri.Scheme is "http" or "https";
                    if (_settings.AllowExternalResources && isWeb)
                    {
                        await route.ContinueAsync();
                    }
                    else
                    {
                        _logger.LogDebug("Blocked external resource {Url}", uri);
                        await route.AbortAsync();
                    }

                    return;
                }

                if (!TryResolveFile(uri.AbsolutePath, out var physicalPath))
                {
                    _logger.LogWarning("PDF asset not found: {Path} (dist={Assets}, app={App}, engine={Engine})",
                        uri.AbsolutePath, AssetsRoot, AppAssetsRoot, EngineRoot);

                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 404,
                        ContentType = "text/plain",
                        Body = $"PDF asset not found: {uri.AbsolutePath}"
                    });
                    return;
                }

                var contentType = GetContentType(physicalPath);

                if (uri.AbsolutePath.EndsWith(EnginePrefix + HarnessFile, StringComparison.OrdinalIgnoreCase))
                {
                    var html = await File.ReadAllTextAsync(physicalPath);
                    await route.FulfillAsync(new RouteFulfillOptions
                    {
                        Status = 200,
                        ContentType = contentType,
                        Body = html
                            .Replace("{{FORMIO_SCRIPT}}", _settings.FormioScript)
                            .Replace("{{FORMIO_STYLESHEET}}", _settings.FormioStylesheet)
                    });
                    return;
                }

                await route.FulfillAsync(new RouteFulfillOptions
                {
                    Status = 200,
                    ContentType = contentType,
                    BodyBytes = await File.ReadAllBytesAsync(physicalPath)
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to serve PDF asset {Url}", route.Request.Url);
                try
                {
                    await route.AbortAsync();
                }
                catch
                {
                    // The page may already be closed - nothing useful left to do.
                }
            }
        }

        /// <summary>
        /// Map a request path onto one of the three asset roots, rejecting any attempt to
        /// escape the root with "..".
        /// </summary>
        private bool TryResolveFile(string absolutePath, out string physicalPath)
        {
            physicalPath = string.Empty;

            var (root, relative) = absolutePath switch
            {
                _ when absolutePath.StartsWith(EnginePrefix, StringComparison.OrdinalIgnoreCase)
                    => (EngineRoot, absolutePath[EnginePrefix.Length..]),
                _ when absolutePath.StartsWith(DistPrefix, StringComparison.OrdinalIgnoreCase)
                    => (AssetsRoot, absolutePath[DistPrefix.Length..]),
                _ when absolutePath.StartsWith(AppPrefix, StringComparison.OrdinalIgnoreCase)
                    => (AppAssetsRoot, absolutePath[AppPrefix.Length..]),
                _ => (string.Empty, string.Empty)
            };

            if (string.IsNullOrEmpty(root) || string.IsNullOrEmpty(relative))
            {
                return false;
            }

            relative = Uri.UnescapeDataString(relative).Replace('/', Path.DirectorySeparatorChar);

            var candidate = Path.GetFullPath(Path.Combine(root, relative));
            var normalizedRoot = Path.GetFullPath(root) + Path.DirectorySeparatorChar;

            if (!candidate.StartsWith(normalizedRoot, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Rejected PDF asset path outside the configured root: {Path}", absolutePath);
                return false;
            }

            if (!File.Exists(candidate))
            {
                return false;
            }

            physicalPath = candidate;
            return true;
        }

        private static string GetContentType(string path) =>
            ContentTypes.TryGetContentType(path, out var contentType)
                ? contentType
                : "application/octet-stream";

        private static string ResolveRoot(string contentRoot, string configuredPath)
        {
            if (string.IsNullOrWhiteSpace(configuredPath))
            {
                return contentRoot;
            }

            return Path.IsPathRooted(configuredPath)
                ? Path.GetFullPath(configuredPath)
                : Path.GetFullPath(Path.Combine(contentRoot, configuredPath));
        }

        public IReadOnlyList<string> Validate()
        {
            var problems = new List<string>();

            if (!File.Exists(Path.Combine(EngineRoot, HarnessFile)))
            {
                problems.Add($"Render harness missing: {Path.Combine(EngineRoot, HarnessFile)} (PdfRenderer:EnginePath)");
            }

            if (!Directory.Exists(AssetsRoot))
            {
                problems.Add($"Rendering assets folder not found: {AssetsRoot} (PdfRenderer:AssetsPath)");
            }
            else
            {
                if (!File.Exists(Path.Combine(AssetsRoot, _settings.FormioScript)))
                {
                    problems.Add($"Form.io bundle missing: {Path.Combine(AssetsRoot, _settings.FormioScript)}");
                }

                if (!File.Exists(Path.Combine(AssetsRoot, _settings.FormioStylesheet)))
                {
                    problems.Add($"Form.io stylesheet missing: {Path.Combine(AssetsRoot, _settings.FormioStylesheet)}");
                }
            }

            if (!Directory.Exists(AppAssetsRoot))
            {
                problems.Add($"App assets folder not found: {AppAssetsRoot} (PdfRenderer:AppAssetsPath)");
            }
            else if (!File.Exists(Path.Combine(AppAssetsRoot, "vendor", "bootswatch-flatly", "bootstrap.min.css")))
            {
                problems.Add("Vendored theme missing: " +
                    Path.Combine(AppAssetsRoot, "vendor", "bootswatch-flatly", "bootstrap.min.css"));
            }

            return problems;
        }
    }

    // =====================================================================================
    //  Content sources
    // =====================================================================================

    /// <summary>
    /// Renders a complete HTML document. Relative "/dist", "/app" and "/engine" URLs still
    /// resolve, so callers can reuse the Form Builder styles.
    /// </summary>
    public sealed class HtmlContentSource : IPdfContentSource
    {
        private readonly string _html;

        public HtmlContentSource(string html) => _html = html ?? throw new ArgumentNullException(nameof(html));

        public string Description => "raw html";

        public Task PrepareAsync(IPage page, CancellationToken cancellationToken) =>
            page.SetContentAsync(_html, new PageSetContentOptions { WaitUntil = WaitUntilState.NetworkIdle });
    }

    /// <summary>Renders a page the browser can reach over http(s).</summary>
    public sealed class UrlContentSource : IPdfContentSource
    {
        private readonly string _url;
        private readonly int _timeoutMs;

        public UrlContentSource(string url, int timeoutMs)
        {
            _url = url ?? throw new ArgumentNullException(nameof(url));
            _timeoutMs = timeoutMs;
        }

        public string Description => _url;

        public async Task PrepareAsync(IPage page, CancellationToken cancellationToken)
        {
            await page.GotoAsync(_url, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.NetworkIdle,
                Timeout = _timeoutMs
            });
        }
    }

    /// <summary>
    /// Drives the Form.io render harness: navigates to render.html, hands it the form schemas
    /// plus submission data and waits until every form is fully rendered and every
    /// collapsible section expanded.
    /// </summary>
    public sealed class FormioContentSource : IPdfContentSource
    {
        private readonly string _harnessUrl;
        private readonly string _payloadJson;
        private readonly int _navigationTimeoutMs;
        private readonly int _renderTimeoutMs;
        private readonly ILogger _logger;

        public FormioContentSource(
            string harnessUrl,
            string payloadJson,
            int navigationTimeoutMs,
            int renderTimeoutMs,
            ILogger logger)
        {
            _harnessUrl = harnessUrl;
            _payloadJson = payloadJson;
            _navigationTimeoutMs = navigationTimeoutMs;
            _renderTimeoutMs = renderTimeoutMs;
            _logger = logger;
        }

        public string Description => "form.io submissions";

        public async Task PrepareAsync(IPage page, CancellationToken cancellationToken)
        {
            await page.GotoAsync(_harnessUrl, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.Load,
                Timeout = _navigationTimeoutMs
            });

            // formio.full.js is a large bundle - make sure it finished evaluating.
            await page.WaitForFunctionAsync(
                "() => !!window.FormPdfRenderer && typeof window.Formio !== 'undefined'",
                null,
                new PageWaitForFunctionOptions { Timeout = _navigationTimeoutMs });

            var renderTask = page.EvaluateAsync<JsonElement?>(
                "payload => window.FormPdfRenderer.render(payload)",
                _payloadJson);

            // EvaluateAsync has no timeout of its own, so guard it explicitly.
            var finished = await Task.WhenAny(renderTask, Task.Delay(_renderTimeoutMs, cancellationToken));
            if (finished != renderTask)
            {
                throw new TimeoutException($"Rendering the form(s) did not finish within {_renderTimeoutMs} ms.");
            }

            LogDiagnostics(await renderTask);

            await page.WaitForFunctionAsync(
                "() => document.body.classList.contains('pdf-render-complete')",
                null,
                new PageWaitForFunctionOptions { Timeout = _renderTimeoutMs });
        }

        private void LogDiagnostics(JsonElement? diagnostics)
        {
            if (diagnostics is not { ValueKind: JsonValueKind.Object } value)
            {
                return;
            }

            var documents = value.TryGetProperty("documents", out var d) ? d.GetInt32() : 0;
            var expanded = value.TryGetProperty("expanded", out var e) ? e.GetInt32() : 0;

            _logger.LogInformation(
                "Rendered {Documents} form document(s), expanded {Expanded} collapsible section(s)",
                documents, expanded);

            if (value.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Array)
            {
                foreach (var error in errors.EnumerateArray())
                {
                    _logger.LogWarning("Form render warning: {Error}", error.GetString());
                }
            }
        }
    }

    // =====================================================================================
    //  The engine
    // =====================================================================================

    /// <summary>
    /// The reusable PDF engine: takes any content source, renders it in headless Chromium and
    /// prints it with Chromium's PrintToPDF. Output is vector based, so the text stays
    /// selectable and searchable.
    /// </summary>
    public sealed class ChromiumPdfEngine : IPdfEngine, IDisposable
    {
        private readonly IPlaywrightBrowserProvider _browserProvider;
        private readonly IPdfAssetProvider _assets;
        private readonly PdfRendererSettings _settings;
        private readonly ILogger<ChromiumPdfEngine> _logger;
        private readonly SemaphoreSlim _concurrency;

        public ChromiumPdfEngine(
            IPlaywrightBrowserProvider browserProvider,
            IPdfAssetProvider assets,
            IOptions<PdfRendererSettings> settings,
            ILogger<ChromiumPdfEngine> logger)
        {
            _browserProvider = browserProvider;
            _assets = assets;
            _settings = settings.Value;
            _logger = logger;
            _concurrency = new SemaphoreSlim(Math.Max(1, _settings.MaxConcurrentRenders));
        }

        public Task<PdfResult> RenderHtmlAsync(string html, PdfGenerationOptions options,
            CancellationToken cancellationToken = default) =>
            RenderAsync(new HtmlContentSource(html), options, cancellationToken);

        public Task<PdfResult> RenderUrlAsync(string url, PdfGenerationOptions options,
            CancellationToken cancellationToken = default) =>
            RenderAsync(new UrlContentSource(url, _settings.NavigationTimeoutMs), options, cancellationToken);

        public async Task<PdfResult> RenderAsync(
            IPdfContentSource source,
            PdfGenerationOptions options,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(source);
            ArgumentNullException.ThrowIfNull(options);

            var problems = _assets.Validate();
            if (problems.Count > 0)
            {
                throw new InvalidOperationException(
                    "The PDF renderer is not configured correctly:" +
                    Environment.NewLine + string.Join(Environment.NewLine, problems));
            }

            var stopwatch = Stopwatch.StartNew();
            var warnings = new List<string>();

            // Keep responsive grids from collapsing on a narrow page (see MinContentWidthPx).
            options.Page.ApplyMinimumContentWidth(_settings.MinContentWidthPx);

            // Bounded wait for a render slot. Queuing until the HTTP timeout fires leaves the
            // caller staring at a pending request for minutes; a 503 lets them retry now.
            var queueWaitSeconds = Math.Max(1, _settings.QueueWaitTimeoutSeconds);
            var queueWait = Stopwatch.StartNew();

            if (!await _concurrency.WaitAsync(queueWaitSeconds * 1000, cancellationToken))
            {
                queueWait.Stop();
                _logger.LogWarning(
                    "PDF rejected as busy after waiting {QueueWaitMs} ms for a render slot " +
                    "(MaxConcurrentRenders={MaxConcurrentRenders}, QueueWaitTimeoutSeconds={QueueWaitTimeoutSeconds})",
                    queueWait.ElapsedMilliseconds, _settings.MaxConcurrentRenders, queueWaitSeconds);

                throw new PdfServiceBusyException(
                    "The PDF service is currently busy. Please try again shortly.",
                    queueWaitSeconds);
            }

            queueWait.Stop();

            try
            {
                var browser = await _browserProvider.GetBrowserAsync(cancellationToken);

                // The viewport is set to the printable width so the layout the harness
                // measures is the same layout Chromium prints.
                var viewportWidth = _settings.ViewportWidth > 0
                    ? _settings.ViewportWidth
                    : options.Page.PrintableWidthPx();

                await using var context = await browser.NewContextAsync(new BrowserNewContextOptions
                {
                    ViewportSize = new ViewportSize
                    {
                        Width = viewportWidth,
                        Height = Math.Max(options.Page.PrintableHeightPx(), 600)
                    },
                    IgnoreHTTPSErrors = true,
                    BypassCSP = true,
                    Locale = "en-US",
                    JavaScriptEnabled = true
                });

                var page = await context.NewPageAsync();
                page.SetDefaultTimeout(options.TimeoutMs);
                page.SetDefaultNavigationTimeout(_settings.NavigationTimeoutMs);

                page.Console += (_, message) =>
                {
                    if (message.Type == "error")
                    {
                        warnings.Add($"console: {message.Text}");
                        _logger.LogDebug("PDF page console error: {Message}", message.Text);
                    }
                };

                page.PageError += (_, error) =>
                {
                    warnings.Add($"page: {error}");
                    _logger.LogWarning("PDF page error: {Error}", error);
                };

                page.RequestFailed += (_, request) =>
                {
                    warnings.Add($"request failed: {request.Url}");
                    _logger.LogDebug("PDF asset request failed: {Url} ({Failure})", request.Url, request.Failure);
                };

                await _assets.ConfigureRoutingAsync(page);

                // Measure and print under print media, exactly like Chrome's Print to PDF.
                await page.EmulateMediaAsync(new PageEmulateMediaOptions { Media = Media.Print });

                await source.PrepareAsync(page, cancellationToken);

                var pdfBytes = await page.PdfAsync(BuildPdfOptions(options));

                stopwatch.Stop();
                _logger.LogInformation(
                    "Generated PDF '{FileName}' ({SizeBytes} bytes) from {Source} in {ElapsedMs} ms " +
                    "(queued {QueueWaitMs} ms)",
                    options.FileName, pdfBytes.Length, source.Description,
                    stopwatch.ElapsedMilliseconds, queueWait.ElapsedMilliseconds);

                return new PdfResult
                {
                    Content = pdfBytes,
                    FileName = options.FileName,
                    GeneratedAt = options.GeneratedAt,
                    Duration = stopwatch.Elapsed,
                    Warnings = warnings
                };
            }
            catch (Exception ex) when (IsBrowserFailure(ex))
            {
                // Chromium itself died mid render. Drop it here so the very next request gets
                // a fresh browser instead of failing the same way.
                await _browserProvider.InvalidateAsync(ex);
                throw;
            }
            finally
            {
                _concurrency.Release();
            }
        }

        /// <summary>
        /// Does this exception mean the shared browser is gone, rather than this one page
        /// having a problem? Matched on the message because Playwright reports a closed or
        /// crashed target through several exception types.
        /// </summary>
        private static bool IsBrowserFailure(Exception ex)
        {
            if (ex is not PlaywrightException)
            {
                return false;
            }

            string[] signatures =
            {
                "Target page, context or browser has been closed",
                "browser has been closed",
                "Browser closed",
                "Target crashed",
                "crashed",
                "Connection closed"
            };

            return signatures.Any(signature =>
                ex.Message.Contains(signature, StringComparison.OrdinalIgnoreCase));
        }

        private static PagePdfOptions BuildPdfOptions(PdfGenerationOptions options)
        {
            var page = options.Page;
            var headerFooter = options.HeaderFooter;

            var pdfOptions = new PagePdfOptions
            {
                Format = page.PreferCssPageSize ? null : page.Format,
                Landscape = page.Landscape,
                PrintBackground = page.PrintBackground,
                PreferCSSPageSize = page.PreferCssPageSize,
                Scale = page.Scale <= 0 ? 1f : page.Scale,
                Margin = new Margin
                {
                    Top = page.MarginTop,
                    Right = page.MarginRight,
                    Bottom = page.MarginBottom,
                    Left = page.MarginLeft
                },
                DisplayHeaderFooter = headerFooter.Enabled,
                // Tagged output keeps the document structure, which is what makes the text
                // searchable and the PDF accessible.
                Tagged = true
            };

            if (headerFooter.Enabled)
            {
                pdfOptions.HeaderTemplate = headerFooter.BuildHeaderTemplate();
                pdfOptions.FooterTemplate = headerFooter.BuildFooterTemplate(options.GeneratedAt);
            }

            if (!string.IsNullOrWhiteSpace(page.PageRanges))
            {
                pdfOptions.PageRanges = page.PageRanges;
            }

            return pdfOptions;
        }

        public async Task<PdfEngineHealth> CheckHealthAsync(CancellationToken cancellationToken = default)
        {
            var health = new PdfEngineHealth
            {
                Mode = _settings.Mode,
                AssetsPath = _assets.AssetsRoot,
                AppAssetsPath = _assets.AppAssetsRoot,
                EnginePath = _assets.EngineRoot,
                Problems = _assets.Validate().ToList()
            };

            try
            {
                var browser = await _browserProvider.GetBrowserAsync(cancellationToken);
                health.BrowserVersion = browser.Version;
            }
            catch (Exception ex)
            {
                health.Problems.Add($"Chromium is unavailable: {ex.Message}");
            }

            health.IsHealthy = health.Problems.Count == 0;
            return health;
        }

        public void Dispose() => _concurrency.Dispose();
    }
}
