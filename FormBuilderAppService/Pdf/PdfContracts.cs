using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Net;
using Microsoft.Playwright;

namespace FormBuilderAppService.Pdf
{
    // =====================================================================================
    //  Configuration
    // =====================================================================================

    /// <summary>
    /// Strongly typed configuration for the PDF rendering engine.
    /// Bound from the "PdfRenderer" section of appsettings.json.
    /// </summary>
    public class PdfRendererSettings
    {
        public const string SectionName = "PdfRenderer";

        /// <summary>
        /// "Development" reads the rendering assets straight out of the frontend project
        /// so a frontend rebuild is picked up without copying anything.
        /// "Production" reads them from the copy published into wwwroot/pdf.
        /// </summary>
        public string Mode { get; set; } = "Development";

        /// <summary>
        /// Root of the frontend build output (formio bundles, stylesheets, fonts).
        /// Relative paths are resolved against the application content root.
        /// </summary>
        public string AssetsPath { get; set; } = "../FormBuilderJs/dist";

        /// <summary>
        /// Root of the frontend application assets (custom css, vendored bootstrap, jquery).
        /// Relative paths are resolved against the content root.
        /// </summary>
        public string AppAssetsPath { get; set; } = "../FormBuilderJs/app";

        /// <summary>
        /// Location of the render harness shipped with the API (render.html).
        /// Relative paths are resolved against the content root.
        /// </summary>
        public string EnginePath { get; set; } = "wwwroot/pdf-engine";

        /// <summary>Form.io bundle used for rendering, relative to <see cref="AssetsPath"/>.</summary>
        public string FormioScript { get; set; } = "formio.full.min.js";

        /// <summary>Form.io stylesheet used for rendering, relative to <see cref="AssetsPath"/>.</summary>
        public string FormioStylesheet { get; set; } = "formio.full.css";

        /// <summary>
        /// Synthetic host the headless browser navigates to. Every request to this host is
        /// served from disk by the engine, so no web server or network is involved.
        /// </summary>
        public string VirtualHost { get; set; } = "formbuilder-pdf.local";

        /// <summary>
        /// Allow the rendered page to fetch http(s) resources that are not served from disk
        /// (for example submission images stored on a CDN).
        ///
        /// Off by default: an unreachable or slow third party host would otherwise stall the
        /// render and hold a concurrency slot until the render timeout fires. Turn it on only
        /// when the forms genuinely need remote assets.
        /// </summary>
        public bool AllowExternalResources { get; set; }

        /// <summary>Run Chromium headless. Only set to false when debugging locally.</summary>
        public bool Headless { get; set; } = true;

        /// <summary>Download the Chromium build automatically when it is missing.</summary>
        public bool AutoInstallBrowser { get; set; } = true;

        /// <summary>
        /// Extra Chromium switches. "--no-sandbox" is usually required inside a container.
        /// </summary>
        public List<string> BrowserArgs { get; set; } = new()
        {
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--font-render-hinting=none"
        };

        public int NavigationTimeoutMs { get; set; } = 60000;

        public int RenderTimeoutMs { get; set; } = 180000;

        /// <summary>Time the harness waits after each render step for layout to settle.</summary>
        public int RenderSettleDelayMs { get; set; } = 400;

        /// <summary>
        /// Maximum number of pages rendered at the same time. Each render costs one Chromium
        /// tab, so this is the main memory control on a busy server.
        /// </summary>
        public int MaxConcurrentRenders { get; set; } = 2;

        /// <summary>
        /// How long a request waits for a free render slot before the service reports that it
        /// is busy. Without this, callers queue behind <see cref="MaxConcurrentRenders"/> until
        /// the HTTP timeout fires; with it they get an immediate, actionable 503 instead.
        /// </summary>
        public int QueueWaitTimeoutSeconds { get; set; } = 30;

        /// <summary>
        /// Maximum number of submissions one request may merge into a single PDF. Guards
        /// against a caller asking for thousands of documents in one render.
        /// </summary>
        public int MaxSubmissionsPerRequest { get; set; } = 20;

        /// <summary>How long to wait for Chromium to start before giving up, in seconds.</summary>
        public int BrowserLaunchTimeoutSeconds { get; set; } = 120;

        /// <summary>
        /// Override the layout width in CSS pixels. 0 (default) derives it from the paper
        /// size and margins so the on-screen layout equals the printed layout.
        /// </summary>
        public int ViewportWidth { get; set; }

        /// <summary>
        /// Minimum width, in CSS pixels, the page is laid out at before Chromium scales it
        /// onto the paper.
        ///
        /// A4 minus margins is only ~718px, which is below Bootstrap's md breakpoint (768px),
        /// so every col-md-* would collapse to full width and multi-column rows (header
        /// fields, signature blocks) would stack. Laying out at 992px (Bootstrap lg) keeps
        /// the columns side by side exactly like the Preview page. Set to 0 to disable.
        /// </summary>
        public int MinContentWidthPx { get; set; } = 992;

        /// <summary>Default paper settings; individual requests may override them.</summary>
        public PdfPageOptions Page { get; set; } = new();

        /// <summary>Default header/footer settings; individual requests may override them.</summary>
        public PdfHeaderFooterOptions HeaderFooter { get; set; } = new();

        /// <summary>Defaults for the fillable AcroForm PDF; individual requests may override them.</summary>
        public AcroFormSettings AcroForm { get; set; } = new();

        public bool IsProduction =>
            string.Equals(Mode, "Production", StringComparison.OrdinalIgnoreCase);
    }

    // =====================================================================================
    //  Options and results
    // =====================================================================================

    /// <summary>
    /// Paper settings handed to Chromium's PrintToPDF.
    /// </summary>
    public class PdfPageOptions
    {
        private const double PxPerInch = 96d;
        private const double PtPerInch = 72d;
        private const double MmPerInch = 25.4d;

        private static readonly Dictionary<string, (double WidthIn, double HeightIn)> Formats =
            new(StringComparer.OrdinalIgnoreCase)
            {
                ["A3"] = (11.69, 16.54),
                ["A4"] = (8.27, 11.69),
                ["A5"] = (5.83, 8.27),
                ["Letter"] = (8.5, 11),
                ["Legal"] = (8.5, 14),
                ["Tabloid"] = (11, 17)
            };

        /// <summary>A4, A3, A5, Letter, Legal or Tabloid.</summary>
        public string Format { get; set; } = "A4";

        public bool Landscape { get; set; }

        public string MarginTop { get; set; } = "12mm";

        public string MarginRight { get; set; } = "10mm";

        public string MarginBottom { get; set; } = "16mm";

        public string MarginLeft { get; set; } = "10mm";

        /// <summary>Content scale, 0.1 - 2.0. 1 keeps Chrome's "Print to PDF" default.</summary>
        public float Scale { get; set; } = 1f;

        public bool PrintBackground { get; set; } = true;

        /// <summary>Let an @page rule in the document win over <see cref="Format"/>.</summary>
        public bool PreferCssPageSize { get; set; }

        /// <summary>Page ranges such as "1-5, 8". Empty prints everything.</summary>
        public string? PageRanges { get; set; }

        public PdfPageOptions Clone() => new()
        {
            Format = Format,
            Landscape = Landscape,
            MarginTop = MarginTop,
            MarginRight = MarginRight,
            MarginBottom = MarginBottom,
            MarginLeft = MarginLeft,
            Scale = Scale,
            PrintBackground = PrintBackground,
            PreferCssPageSize = PreferCssPageSize,
            PageRanges = PageRanges
        };

        /// <summary>
        /// Width available to the content, in CSS pixels. The browser viewport is set to this
        /// value so the on-screen layout matches the printed layout exactly.
        /// </summary>
        public int PrintableWidthPx()
        {
            var (widthIn, heightIn) = PaperSizeInches();
            var pageWidthIn = Landscape ? heightIn : widthIn;
            var contentIn = pageWidthIn - ToInches(MarginLeft) - ToInches(MarginRight);
            return (int)Math.Round(Math.Max(contentIn, 1d) * PxPerInch / EffectiveScale());
        }

        /// <summary>
        /// Height available to the content, in CSS pixels. Used by the harness to decide
        /// whether a component still fits on the current page.
        /// </summary>
        public int PrintableHeightPx() => (int)Math.Round(PrintableHeightPxExact());

        /// <summary>
        /// Same as <see cref="PrintableHeightPx"/> but unrounded. The AcroForm harness walks
        /// page after page in this unit, so half a pixel of rounding per page would slowly
        /// push the injected form fields away from the controls they sit on.
        /// </summary>
        public double PrintableHeightPxExact()
        {
            var (widthIn, heightIn) = PaperSizeInches();
            var pageHeightIn = Landscape ? widthIn : heightIn;
            var contentIn = pageHeightIn - ToInches(MarginTop) - ToInches(MarginBottom);
            return Math.Max(contentIn, 1d) * PxPerInch / EffectiveScale();
        }

        /// <summary>Left margin in PDF points, the unit PDF form field rectangles use.</summary>
        public double MarginLeftPt() => ToInches(MarginLeft) * PtPerInch;

        /// <summary>Top margin in PDF points.</summary>
        public double MarginTopPt() => ToInches(MarginTop) * PtPerInch;

        /// <summary>The scale actually handed to PrintToPDF (0 and negatives mean "unscaled").</summary>
        public float EffectiveScale() => Scale <= 0 ? 1f : Scale;

        /// <summary>
        /// Reduce <see cref="Scale"/> until the layout width reaches
        /// <paramref name="minContentWidthPx"/>, so responsive grids keep their columns
        /// instead of collapsing on a narrow sheet of paper. Chromium then scales the wider
        /// layout down onto the page. Idempotent, and never scales content up.
        /// </summary>
        public PdfPageOptions ApplyMinimumContentWidth(int minContentWidthPx)
        {
            if (minContentWidthPx <= 0)
            {
                return this;
            }

            var currentWidth = PrintableWidthPx();
            if (currentWidth >= minContentWidthPx)
            {
                return this;
            }

            // width = paperContent / scale, so the scale that yields exactly the minimum is
            // scale * currentWidth / minimum. Chromium rejects anything below 0.1.
            var target = EffectiveScale() * currentWidth / (float)minContentWidthPx;
            Scale = Math.Max(0.1f, (float)Math.Round(target, 4));

            return this;
        }

        private (double WidthIn, double HeightIn) PaperSizeInches() =>
            Formats.TryGetValue(Format ?? "A4", out var size) ? size : Formats["A4"];

        /// <summary>Convert a CSS length ("12mm", "0.5in", "40px", "1cm") to inches.</summary>
        internal static double ToInches(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return 0d;
            }

            var text = value.Trim().ToLowerInvariant();
            var unit = "px";

            foreach (var candidate in new[] { "mm", "cm", "in", "px", "pt" })
            {
                if (text.EndsWith(candidate, StringComparison.Ordinal))
                {
                    unit = candidate;
                    text = text[..^candidate.Length];
                    break;
                }
            }

            if (!double.TryParse(text.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
            {
                return 0d;
            }

            return unit switch
            {
                "mm" => number / MmPerInch,
                "cm" => number * 10 / MmPerInch,
                "in" => number,
                "pt" => number / 72d,
                _ => number / PxPerInch
            };
        }
    }

    /// <summary>
    /// Configurable page header and footer. Chromium renders these outside the page body, so
    /// they must be self contained HTML with inline styles. The classes pageNumber,
    /// totalPages, date, title and url are substituted by Chromium.
    /// </summary>
    public class PdfHeaderFooterOptions
    {
        public bool Enabled { get; set; } = true;

        /// <summary>Custom header HTML. When null the header is left empty.</summary>
        public string? HeaderHtml { get; set; }

        /// <summary>Custom footer HTML. When null the footer is built from the flags below.</summary>
        public string? FooterHtml { get; set; }

        public bool ShowPrintedDate { get; set; } = true;

        public bool ShowPageNumbers { get; set; } = true;

        /// <summary>Free text placed in the middle of the footer (for example a form name).</summary>
        public string? FooterText { get; set; }

        public string PrintedDateLabel { get; set; } = "Printed";

        public string DateFormat { get; set; } = "dd MMM yyyy HH:mm";

        public string FontSize { get; set; } = "9px";

        public string FontFamily { get; set; } = "Lato, Helvetica, Arial, sans-serif";

        public string Color { get; set; } = "#6c757d";

        /// <summary>Side padding; should line up with the page margins.</summary>
        public string SidePadding { get; set; } = "10mm";

        public PdfHeaderFooterOptions Clone() => new()
        {
            Enabled = Enabled,
            HeaderHtml = HeaderHtml,
            FooterHtml = FooterHtml,
            ShowPrintedDate = ShowPrintedDate,
            ShowPageNumbers = ShowPageNumbers,
            FooterText = FooterText,
            PrintedDateLabel = PrintedDateLabel,
            DateFormat = DateFormat,
            FontSize = FontSize,
            FontFamily = FontFamily,
            Color = Color,
            SidePadding = SidePadding
        };

        /// <summary>Chromium needs a non-empty template when header/footer display is on.</summary>
        public string BuildHeaderTemplate() =>
            string.IsNullOrWhiteSpace(HeaderHtml) ? "<div></div>" : Wrap(HeaderHtml!);

        public string BuildFooterTemplate(DateTimeOffset generatedAt)
        {
            if (!string.IsNullOrWhiteSpace(FooterHtml))
            {
                return Wrap(FooterHtml!);
            }

            var left = ShowPrintedDate
                ? $"<span>{WebUtility.HtmlEncode(PrintedDateLabel)}: " +
                  $"{WebUtility.HtmlEncode(generatedAt.ToLocalTime().ToString(DateFormat))}</span>"
                : "<span></span>";

            var center = string.IsNullOrWhiteSpace(FooterText)
                ? "<span></span>"
                : $"<span>{WebUtility.HtmlEncode(FooterText)}</span>";

            var right = ShowPageNumbers
                ? "<span>Page <span class=\"pageNumber\"></span> of <span class=\"totalPages\"></span></span>"
                : "<span></span>";

            return Wrap($"{left}{center}{right}");
        }

        private string Wrap(string inner) =>
            "<div style=\"width:100%;box-sizing:border-box;" +
            $"padding:0 {SidePadding};font-size:{FontSize};font-family:{FontFamily};color:{Color};" +
            "display:flex;align-items:center;justify-content:space-between;\">" +
            inner +
            "</div>";
    }

    /// <summary>
    /// Everything the PDF engine needs for one document, independent of what is being
    /// rendered (forms, invoices, reports, EHR documents).
    /// </summary>
    public class PdfGenerationOptions
    {
        public PdfPageOptions Page { get; set; } = new();

        public PdfHeaderFooterOptions HeaderFooter { get; set; } = new();

        /// <summary>Suggested download file name, without a path.</summary>
        public string FileName { get; set; } = "document.pdf";

        /// <summary>Document title metadata.</summary>
        public string? Title { get; set; }

        /// <summary>Overall timeout for preparing the page, in milliseconds.</summary>
        public int TimeoutMs { get; set; } = 180000;

        public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.Now;
    }

    /// <summary>A generated PDF plus the metadata callers need to serve or store it.</summary>
    public class PdfResult
    {
        public byte[] Content { get; set; } = Array.Empty<byte>();

        public string FileName { get; set; } = "document.pdf";

        public string ContentType { get; } = "application/pdf";

        /// <summary>
        /// Correlation id shared by every log line written for this render, also returned to
        /// the caller as the X-Pdf-Request-Id header so a reported failure can be found in
        /// the logs.
        /// </summary>
        public string RequestId { get; set; } = string.Empty;

        /// <summary>Number of source documents merged into this PDF.</summary>
        public int DocumentCount { get; set; }

        public DateTimeOffset GeneratedAt { get; set; } = DateTimeOffset.Now;

        public TimeSpan Duration { get; set; }

        /// <summary>Non fatal problems reported by the renderer (missing image, ...).</summary>
        public List<string> Warnings { get; set; } = new();

        public long SizeBytes => Content.LongLength;
    }

    /// <summary>
    /// Raised when no render slot became free within PdfRenderer:QueueWaitTimeoutSeconds.
    /// This is normal backpressure rather than a fault - the controller maps it to
    /// 503 Service Unavailable with a Retry-After header so the caller can retry.
    /// </summary>
    public sealed class PdfServiceBusyException : Exception
    {
        public PdfServiceBusyException(string message, int retryAfterSeconds)
            : base(message) => RetryAfterSeconds = retryAfterSeconds;

        /// <summary>Suggested wait before retrying, in seconds.</summary>
        public int RetryAfterSeconds { get; }
    }

    // =====================================================================================
    //  Requests
    // =====================================================================================

    /// <summary>Request for turning one or more form submissions into a single PDF.</summary>
    public class FormPdfRequest
    {
        /// <summary>
        /// Submission ids to render, in the order they should appear in the PDF. One id
        /// produces a single form PDF; several ids produce one PDF where each form starts on
        /// a new page.
        /// </summary>
        [Required]
        [MinLength(1, ErrorMessage = "At least one submissionId is required")]
        public List<string> SubmissionIds { get; set; } = new();

        /// <summary>Paper overrides; falls back to PdfRenderer:Page when omitted.</summary>
        public PdfPageOptions? Page { get; set; }

        /// <summary>Header/footer overrides; falls back to PdfRenderer:HeaderFooter.</summary>
        public PdfHeaderFooterOptions? HeaderFooter { get; set; }

        /// <summary>Expand every collapsed panel/accordion before printing.</summary>
        public bool ExpandCollapsible { get; set; } = true;

        /// <summary>Print the form title above each submission.</summary>
        public bool ShowDocumentTitle { get; set; } = true;

        /// <summary>Print submission id / date / version under the title.</summary>
        public bool ShowSubmissionMeta { get; set; } = true;

        /// <summary>
        /// Replace read-only inputs with plain text before printing. Only needed for viewers
        /// that cannot extract text from form controls.
        /// </summary>
        public bool FlattenInputs { get; set; }

        /// <summary>
        /// How Form.io Tabs are laid out once flattened: "auto" (default) lets a tab move to
        /// the next page only when it does not fit, "always" starts every tab on a new page.
        /// </summary>
        public string TabPageBreak { get; set; } = "auto";

        /// <summary>Print each tab's label as a heading above its flattened content.</summary>
        public bool ShowTabTitles { get; set; } = true;

        /// <summary>Override the generated file name.</summary>
        public string? FileName { get; set; }
    }

    /// <summary>
    /// Generic request for the reusable engine: render arbitrary HTML (or a URL) to PDF.
    /// Used by reports, invoices and any other consumer of the PDF service.
    /// </summary>
    public class HtmlPdfRequest
    {
        /// <summary>Raw HTML document. Ignored when <see cref="Url"/> is supplied.</summary>
        public string? Html { get; set; }

        /// <summary>Absolute http(s) URL to render.</summary>
        public string? Url { get; set; }

        public PdfPageOptions? Page { get; set; }

        public PdfHeaderFooterOptions? HeaderFooter { get; set; }

        public string? FileName { get; set; }

        public string? Title { get; set; }
    }

    // =====================================================================================
    //  Render harness payload (contract with wwwroot/pdf-engine/render.html)
    // =====================================================================================

    /// <summary>
    /// Payload handed to window.FormPdfRenderer.render() inside headless Chromium.
    /// Serialised with camelCase names, which is the contract render.html expects.
    /// </summary>
    public class FormRenderPayload
    {
        public List<FormRenderDocument> Documents { get; set; } = new();

        public FormRenderOptions Options { get; set; } = new();
    }

    public class FormRenderDocument
    {
        public string? Id { get; set; }

        public string? Title { get; set; }

        /// <summary>The form schema exactly as /api/forms/{id} returns it.</summary>
        public object? FormSchema { get; set; }

        /// <summary>The submission document exactly as /api/formsubmissions/{id} returns it.</summary>
        public object? Submission { get; set; }

        public FormRenderDocumentMeta? Meta { get; set; }
    }

    public class FormRenderDocumentMeta
    {
        public string? SubmissionId { get; set; }

        public string? SubmittedOn { get; set; }

        public string? Version { get; set; }

        public string? FormName { get; set; }
    }

    public class FormRenderOptions
    {
        public bool ExpandCollapsible { get; set; } = true;

        public bool ShowDocumentTitle { get; set; } = true;

        public bool ShowSubmissionMeta { get; set; } = true;

        public bool ApplyPageBreakRules { get; set; } = true;

        public bool FlattenInputs { get; set; }

        /// <summary>"auto" breaks between tabs only when one does not fit; "always" starts every tab on a new page.</summary>
        public string TabPageBreak { get; set; } = "auto";

        /// <summary>Print each tab's label as a heading above its flattened content.</summary>
        public bool ShowTabTitles { get; set; } = true;

        /// <summary>Printable page height in CSS pixels, used for page break decisions.</summary>
        public int UsablePageHeightPx { get; set; } = 970;

        public int SettleDelayMs { get; set; } = 400;

        public int AssetTimeoutMs { get; set; } = 15000;
    }

    // =====================================================================================
    //  Abstractions
    // =====================================================================================

    /// <summary>
    /// Puts content on the page before it is printed. Implement this to teach the engine a
    /// new document type (forms, invoices, EHR documents, reports) without changing the
    /// engine itself.
    /// </summary>
    public interface IPdfContentSource
    {
        /// <summary>Short description used in logs and errors.</summary>
        string Description { get; }

        /// <summary>
        /// Navigate/inject content and return only once the page is completely rendered -
        /// the engine prints immediately afterwards.
        /// </summary>
        Task PrepareAsync(IPage page, CancellationToken cancellationToken);

        /// <summary>
        /// Optional hook that runs after Chromium has printed, on the page that produced the
        /// document. Return the bytes to send to the caller.
        ///
        /// The default implementation hands the printed bytes straight through, so a content
        /// source that only renders HTML does not have to know this step exists. The AcroForm
        /// source uses it to lay editable PDF form fields over the rendered controls.
        /// </summary>
        Task<byte[]> PostProcessAsync(IPage page, byte[] pdfBytes, CancellationToken cancellationToken)
            => Task.FromResult(pdfBytes);
    }

    /// <summary>
    /// Generic HTML to PDF engine backed by headless Chromium. Reusable by any feature or
    /// application that can produce HTML.
    /// </summary>
    public interface IPdfEngine
    {
        /// <summary>Render whatever the content source puts on the page.</summary>
        Task<PdfResult> RenderAsync(IPdfContentSource source, PdfGenerationOptions options,
            CancellationToken cancellationToken = default);

        /// <summary>Render a complete HTML document.</summary>
        Task<PdfResult> RenderHtmlAsync(string html, PdfGenerationOptions options,
            CancellationToken cancellationToken = default);

        /// <summary>Render a URL the browser can reach.</summary>
        Task<PdfResult> RenderUrlAsync(string url, PdfGenerationOptions options,
            CancellationToken cancellationToken = default);

        /// <summary>Verify Chromium and the rendering assets are usable.</summary>
        Task<PdfEngineHealth> CheckHealthAsync(CancellationToken cancellationToken = default);
    }

    public class PdfEngineHealth
    {
        public bool IsHealthy { get; set; }

        public string Mode { get; set; } = string.Empty;

        public string? BrowserVersion { get; set; }

        public string AssetsPath { get; set; } = string.Empty;

        public string AppAssetsPath { get; set; } = string.Empty;

        public string EnginePath { get; set; } = string.Empty;

        public List<string> Problems { get; set; } = new();
    }

    /// <summary>
    /// Owns the long lived Chromium instance. Registered as a singleton so browser startup
    /// is paid once per process instead of once per PDF.
    /// </summary>
    public interface IPlaywrightBrowserProvider : IAsyncDisposable
    {
        Task<IBrowser> GetBrowserAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Discard the current Chromium instance so the next caller gets a fresh one. Called
        /// after a render fails in a way that suggests the browser itself died, so the service
        /// recovers without an application restart. A browser that is still connected is left
        /// alone - other renders may be using it.
        /// </summary>
        Task InvalidateAsync(Exception? reason = null);

        /// <summary>Chromium build string, or null when the browser has not started.</summary>
        string? BrowserVersion { get; }
    }

    /// <summary>
    /// Serves the rendering assets to the headless browser straight from disk, so the PDF
    /// service needs neither a web server nor network access.
    /// </summary>
    public interface IPdfAssetProvider
    {
        /// <summary>Synthetic origin the browser navigates to.</summary>
        string BaseUrl { get; }

        /// <summary>Absolute URL of the Form.io render harness.</summary>
        string HarnessUrl { get; }

        string AssetsRoot { get; }

        string AppAssetsRoot { get; }

        string EngineRoot { get; }

        /// <summary>Intercept every request made by the page and fulfil it from disk.</summary>
        Task ConfigureRoutingAsync(IPage page);

        /// <summary>Problems that would stop rendering (missing bundle, missing harness).</summary>
        IReadOnlyList<string> Validate();
    }

    /// <summary>
    /// Turns Form Builder submissions into PDFs. Sits on top of the generic
    /// <see cref="IPdfEngine"/> and can be called from controllers, background jobs or any
    /// other application through the API.
    /// </summary>
    public interface IFormPdfService
    {
        /// <summary>Render one or more submissions into a single PDF.</summary>
        Task<PdfResult> GenerateAsync(FormPdfRequest request, CancellationToken cancellationToken = default);

        /// <summary>Convenience overload for a single submission.</summary>
        Task<PdfResult> GenerateAsync(string submissionId, CancellationToken cancellationToken = default);
    }

    // =====================================================================================
    //  Registration
    // =====================================================================================

    /// <summary>
    /// Single entry point for wiring the PDF module into any host - the API, a worker
    /// service or a future application.
    /// </summary>
    public static class PdfServiceCollectionExtensions
    {
        public static IServiceCollection AddPdfRenderer(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<PdfRendererSettings>(configuration.GetSection(PdfRendererSettings.SectionName));

            // Chromium and the asset resolver are process wide - starting the browser once is
            // what keeps generation fast.
            services.AddSingleton<IPlaywrightBrowserProvider, PlaywrightBrowserProvider>();
            services.AddSingleton<IPdfAssetProvider, PdfAssetProvider>();
            services.AddSingleton<IPdfEngine, ChromiumPdfEngine>();

            // Feature services follow the lifetime of the repositories they depend on.
            services.AddScoped<IFormPdfService, FormPdfService>();
            services.AddScoped<IAcroFormPdfService, AcroFormPdfService>();

            return services;
        }
    }
}
