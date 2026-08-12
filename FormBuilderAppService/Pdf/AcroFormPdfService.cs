using System.Diagnostics;
using System.Text.Json;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.Extensions.Options;
using Microsoft.Playwright;

namespace FormBuilderAppService.Pdf
{
    /// <summary>
    /// Builds fillable (AcroForm) PDFs from a form definition.
    ///
    /// The document itself is produced by exactly the same renderer as the read-only
    /// submission PDF - render.html, the Preview page stylesheets and Chromium's PrintToPDF -
    /// so it looks identical. The only extra step happens after printing: the bytes are handed
    /// back to the page that produced them, where pdf-lib lays a transparent PDF form field
    /// over every control the harness measured.
    /// </summary>
    public sealed class AcroFormPdfService : IAcroFormPdfService
    {
        private static readonly JsonSerializerOptions PayloadJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        /// <summary>Values accepted for <see cref="AcroFormPdfRequest.TabPageBreak"/>.</summary>
        private static readonly string[] TabPageBreakModes = { "auto", "always" };

        private readonly IFormService _formService;
        private readonly IPdfEngine _pdfEngine;
        private readonly IPdfAssetProvider _assets;
        private readonly PdfRendererSettings _settings;
        private readonly ILogger<AcroFormPdfService> _logger;

        public AcroFormPdfService(
            IFormService formService,
            IPdfEngine pdfEngine,
            IPdfAssetProvider assets,
            IOptions<PdfRendererSettings> settings,
            ILogger<AcroFormPdfService> logger)
        {
            _formService = formService;
            _pdfEngine = pdfEngine;
            _assets = assets;
            _settings = settings.Value;
            _logger = logger;
        }

        public Task<PdfResult> GenerateAsync(string formId, CancellationToken cancellationToken = default) =>
            GenerateAsync(new AcroFormPdfRequest { FormId = formId }, cancellationToken);

        public async Task<PdfResult> GenerateAsync(
            AcroFormPdfRequest request,
            CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);

            var requestId = Guid.NewGuid().ToString("N")[..12];
            var formId = (request.FormId ?? string.Empty).Trim();

            // No paramName: the message is shown to the end user, and ArgumentException would
            // append "(Parameter 'formId')" to it.
            if (string.IsNullOrWhiteSpace(formId))
            {
                throw new ArgumentException("formId is required.");
            }

            var tabPageBreak = NormalizeTabPageBreak(request.TabPageBreak);

            using var logScope = _logger.BeginScope(new Dictionary<string, object?>
            {
                ["PdfRequestId"] = requestId,
                ["FormId"] = formId
            });

            var stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("AcroForm PDF {PdfRequestId} started | form={FormId}", requestId, formId);

            try
            {
                var form = await _formService.GetFormByIdAsync(formId)
                    ?? throw new KeyNotFoundException($"Form {formId} was not found.");

                var title = !string.IsNullOrWhiteSpace(form.Title) ? form.Title : form.Name;

                // Applied here as well as in the engine so the harness measures page breaks
                // against the same (widened) layout Chromium will print.
                var page = (request.Page ?? _settings.Page.Clone())
                    .ApplyMinimumContentWidth(_settings.MinContentWidthPx);

                var options = new PdfGenerationOptions
                {
                    Page = page,
                    HeaderFooter = request.HeaderFooter ?? _settings.HeaderFooter.Clone(),
                    Title = title,
                    TimeoutMs = _settings.RenderTimeoutMs,
                    GeneratedAt = DateTimeOffset.Now,
                    FileName = BuildFileName(request, title)
                };

                var payload = new AcroFormRenderPayload
                {
                    Document = new AcroFormRenderDocument
                    {
                        Id = form.Id,
                        Title = title,
                        FormSchema = form
                    },
                    Options = new AcroFormRenderOptions
                    {
                        ExpandCollapsible = request.ExpandCollapsible,
                        ShowDocumentTitle = request.ShowDocumentTitle,
                        TabPageBreak = tabPageBreak,
                        ShowTabTitles = request.ShowTabTitles,
                        TransparentFields = request.TransparentFields ?? _settings.AcroForm.TransparentFields,
                        SettleDelayMs = _settings.RenderSettleDelayMs,
                        PageHeightPx = page.PrintableHeightPxExact(),
                        Scale = page.EffectiveScale(),
                        MarginLeftPt = page.MarginLeftPt(),
                        MarginTopPt = page.MarginTopPt()
                    }
                };

                var source = new AcroFormContentSource(
                    _assets.HarnessUrl,
                    JsonSerializer.Serialize(payload, PayloadJsonOptions),
                    _settings.NavigationTimeoutMs,
                    _settings.RenderTimeoutMs,
                    _logger);

                var result = await _pdfEngine.RenderAsync(source, options, cancellationToken);

                result.RequestId = requestId;
                result.DocumentCount = 1;

                stopwatch.Stop();
                _logger.LogInformation(
                    "AcroForm PDF {PdfRequestId} succeeded | form={FormId} fields={FieldCount} pages={PageCount} " +
                    "size={SizeBytes} bytes render={RenderMs} ms total={TotalMs} ms file={FileName}",
                    requestId, formId, source.FieldCount, source.PageCount, result.SizeBytes,
                    (long)result.Duration.TotalMilliseconds, stopwatch.ElapsedMilliseconds, result.FileName);

                return result;
            }
            catch (PdfServiceBusyException ex)
            {
                // Expected backpressure, not a fault - keep it out of the error logs.
                stopwatch.Stop();
                _logger.LogWarning(
                    "AcroForm PDF {PdfRequestId} rejected as busy after {TotalMs} ms | form={FormId} | {ErrorMessage}",
                    requestId, stopwatch.ElapsedMilliseconds, formId, ex.Message);
                throw;
            }
            catch (OperationCanceledException)
            {
                stopwatch.Stop();
                _logger.LogInformation(
                    "AcroForm PDF {PdfRequestId} cancelled by the caller after {TotalMs} ms | form={FormId}",
                    requestId, stopwatch.ElapsedMilliseconds, formId);
                throw;
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex,
                    "AcroForm PDF {PdfRequestId} failed after {TotalMs} ms | form={FormId} error={ErrorType}: {ErrorMessage}",
                    requestId, stopwatch.ElapsedMilliseconds, formId, ex.GetType().Name, ex.Message);
                throw;
            }
        }

        private static string NormalizeTabPageBreak(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return TabPageBreakModes[0];
            }

            var normalized = value.Trim().ToLowerInvariant();
            if (!TabPageBreakModes.Contains(normalized, StringComparer.Ordinal))
            {
                throw new ArgumentException(
                    $"Invalid tabPageBreak '{value}'. Allowed values are: {string.Join(", ", TabPageBreakModes)}.");
            }

            return normalized;
        }

        private static string BuildFileName(AcroFormPdfRequest request, string? formTitle)
        {
            if (!string.IsNullOrWhiteSpace(request.FileName))
            {
                var provided = Sanitize(request.FileName!);
                return provided.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? provided : provided + ".pdf";
            }

            return Sanitize(string.IsNullOrWhiteSpace(formTitle) ? "form" : formTitle!) + ".pdf";
        }

        private static string Sanitize(string value)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var cleaned = new string(value.Select(c => invalid.Contains(c) || c == ' ' ? '_' : c).ToArray());
            return string.IsNullOrWhiteSpace(cleaned) ? "document" : cleaned;
        }
    }

    // =====================================================================================
    //  Content source
    // =====================================================================================

    /// <summary>
    /// Drives the AcroForm half of the render harness.
    ///
    /// <see cref="PrepareAsync"/> renders the blank form and lets the harness record where
    /// every control will land on paper; <see cref="PostProcessAsync"/> runs after Chromium
    /// has printed and hands the flat PDF back to the same page so pdf-lib can add the real
    /// form fields. Doing the post-processing in the browser that already produced the
    /// document keeps the whole feature free of a server side PDF library.
    /// </summary>
    public sealed class AcroFormContentSource : IPdfContentSource
    {
        private readonly string _harnessUrl;
        private readonly string _payloadJson;
        private readonly int _navigationTimeoutMs;
        private readonly int _renderTimeoutMs;
        private readonly ILogger _logger;

        public AcroFormContentSource(
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

        public string Description => "form.io acroform";

        /// <summary>Number of PDF form fields the harness produced. Logged by the service.</summary>
        public int FieldCount { get; private set; }

        /// <summary>Number of printed pages the harness predicted.</summary>
        public int PageCount { get; private set; }

        public async Task PrepareAsync(IPage page, CancellationToken cancellationToken)
        {
            await page.GotoAsync(_harnessUrl, new PageGotoOptions
            {
                WaitUntil = WaitUntilState.Load,
                Timeout = _navigationTimeoutMs
            });

            // formio.full.js is a large bundle - make sure it finished evaluating.
            await page.WaitForFunctionAsync(
                "() => !!window.FormAcroForm && typeof window.Formio !== 'undefined'",
                null,
                new PageWaitForFunctionOptions { Timeout = _navigationTimeoutMs });

            var renderTask = page.EvaluateAsync<JsonElement?>(
                "payload => window.FormAcroForm.render(payload)",
                _payloadJson);

            // EvaluateAsync has no timeout of its own, so guard it explicitly.
            var finished = await Task.WhenAny(renderTask, Task.Delay(_renderTimeoutMs, cancellationToken));
            if (finished != renderTask)
            {
                throw new TimeoutException($"Rendering the AcroForm did not finish within {_renderTimeoutMs} ms.");
            }

            LogDiagnostics(await renderTask);

            await page.WaitForFunctionAsync(
                "() => document.body.classList.contains('pdf-render-complete')",
                null,
                new PageWaitForFunctionOptions { Timeout = _renderTimeoutMs });
        }

        /// <summary>
        /// Add the AcroForm fields to the freshly printed document. The bytes travel to the
        /// browser and back as base64 - a few hundred kilobytes, which is cheap next to the
        /// render itself.
        /// </summary>
        public async Task<byte[]> PostProcessAsync(IPage page, byte[] pdfBytes, CancellationToken cancellationToken)
        {
            var applyTask = page.EvaluateAsync<JsonElement?>(
                "base64 => window.FormAcroForm.apply(base64)",
                Convert.ToBase64String(pdfBytes));

            var finished = await Task.WhenAny(applyTask, Task.Delay(_renderTimeoutMs, cancellationToken));
            if (finished != applyTask)
            {
                throw new TimeoutException(
                    $"Adding the AcroForm fields did not finish within {_renderTimeoutMs} ms.");
            }

            var response = await applyTask;
            if (response is not { ValueKind: JsonValueKind.Object } result)
            {
                throw new InvalidOperationException("The AcroForm post processor returned no result.");
            }

            if (!result.TryGetProperty("ok", out var ok) || !ok.GetBoolean())
            {
                var error = result.TryGetProperty("error", out var e) ? e.GetString() : null;
                throw new InvalidOperationException(
                    "Adding the AcroForm fields failed: " + (error ?? "unknown error"));
            }

            if (result.TryGetProperty("fields", out var fields) && fields.ValueKind == JsonValueKind.Number)
            {
                FieldCount = fields.GetInt32();
            }

            var printedPages = result.TryGetProperty("pdfPages", out var pp) && pp.ValueKind == JsonValueKind.Number
                ? pp.GetInt32()
                : 0;

            if (PageCount > 0 && printedPages > 0 && printedPages != PageCount)
            {
                // The harness places fields by page index, so a mismatch means Chromium
                // paginated differently than predicted and some fields may be a page off.
                _logger.LogWarning(
                    "AcroForm pagination mismatch: the harness predicted {PredictedPages} page(s) but the " +
                    "PDF has {PrintedPages}. Field positions on the later pages may be off.",
                    PageCount, printedPages);
            }

            if (result.TryGetProperty("warnings", out var warnings) && warnings.ValueKind == JsonValueKind.Array)
            {
                foreach (var warning in warnings.EnumerateArray())
                {
                    _logger.LogWarning("AcroForm warning: {Warning}", warning.GetString());
                }
            }

            var content = result.TryGetProperty("pdf", out var pdf) ? pdf.GetString() : null;
            if (string.IsNullOrEmpty(content))
            {
                throw new InvalidOperationException("The AcroForm post processor returned an empty document.");
            }

            return Convert.FromBase64String(content);
        }

        private void LogDiagnostics(JsonElement? diagnostics)
        {
            if (diagnostics is not { ValueKind: JsonValueKind.Object } value)
            {
                return;
            }

            if (value.TryGetProperty("fields", out var fields) && fields.ValueKind == JsonValueKind.Number)
            {
                FieldCount = fields.GetInt32();
            }

            if (value.TryGetProperty("pages", out var pages) && pages.ValueKind == JsonValueKind.Number)
            {
                PageCount = pages.GetInt32();
            }

            _logger.LogInformation(
                "AcroForm harness measured {FieldCount} control(s) across {PageCount} predicted page(s) " +
                "| layout={LayoutWidthPx}px content={ContentWidthPx}px",
                FieldCount, PageCount,
                value.TryGetProperty("layoutWidthPx", out var lw) ? lw.ToString() : "?",
                value.TryGetProperty("contentWidthPx", out var cw) ? cw.ToString() : "?");

            if (value.TryGetProperty("errors", out var errors) && errors.ValueKind == JsonValueKind.Array)
            {
                foreach (var error in errors.EnumerateArray())
                {
                    _logger.LogWarning("AcroForm render warning: {Error}", error.GetString());
                }
            }
        }
    }
}
