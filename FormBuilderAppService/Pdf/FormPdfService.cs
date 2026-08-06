using System.Diagnostics;
using System.Text.Json;
using FormBuilderAppService.Models;
using FormBuilderAppService.Models.DTOs;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.Extensions.Options;

namespace FormBuilderAppService.Pdf
{
    /// <summary>
    /// Builds Form Builder PDFs: loads the submissions, loads each form schema once, then
    /// renders everything through the shared <see cref="IPdfEngine"/>.
    ///
    /// All selected submissions are rendered in a single Chromium pass and separated by
    /// forced page breaks, so the merged document keeps one continuous "Page X of Y".
    /// </summary>
    public sealed class FormPdfService : IFormPdfService
    {
        private static readonly JsonSerializerOptions PayloadJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        /// <summary>Values accepted for <see cref="FormPdfRequest.TabPageBreak"/>.</summary>
        private static readonly string[] TabPageBreakModes = { "auto", "always" };

        private readonly IFormSubmissionService _submissionService;
        private readonly IFormService _formService;
        private readonly IPdfEngine _pdfEngine;
        private readonly IPdfAssetProvider _assets;
        private readonly PdfRendererSettings _settings;
        private readonly ILogger<FormPdfService> _logger;

        public FormPdfService(
            IFormSubmissionService submissionService,
            IFormService formService,
            IPdfEngine pdfEngine,
            IPdfAssetProvider assets,
            IOptions<PdfRendererSettings> settings,
            ILogger<FormPdfService> logger)
        {
            _submissionService = submissionService;
            _formService = formService;
            _pdfEngine = pdfEngine;
            _assets = assets;
            _settings = settings.Value;
            _logger = logger;
        }

        public Task<PdfResult> GenerateAsync(string submissionId, CancellationToken cancellationToken = default) =>
            GenerateAsync(new FormPdfRequest { SubmissionIds = new List<string> { submissionId } }, cancellationToken);

        public async Task<PdfResult> GenerateAsync(FormPdfRequest request, CancellationToken cancellationToken = default)
        {
            ArgumentNullException.ThrowIfNull(request);

            var requestId = Guid.NewGuid().ToString("N")[..12];
            var requestedIds = ValidateSubmissionIds(request.SubmissionIds);
            var tabPageBreak = NormalizeTabPageBreak(request.TabPageBreak);

            // Everything logged below this point carries the same correlation id, so a single
            // reported failure can be traced from request to render.
            using var logScope = _logger.BeginScope(new Dictionary<string, object?>
            {
                ["PdfRequestId"] = requestId,
                ["SubmissionIds"] = string.Join(",", requestedIds)
            });

            // Collected while the documents are built so failure logs can name the forms and
            // tenants involved, not just the submission ids.
            var formIds = new HashSet<string>(StringComparer.Ordinal);
            var tenantIds = new HashSet<string>(StringComparer.Ordinal);
            var stopwatch = Stopwatch.StartNew();

            _logger.LogInformation(
                "PDF {PdfRequestId} started | submissions={SubmissionCount} [{SubmissionIds}]",
                requestId, requestedIds.Count, string.Join(",", requestedIds));

            try
            {
                var submissions = await _submissionService.GetFormSubmissionsByIdsAsync(requestedIds);
                if (submissions.Count == 0)
                {
                    throw new KeyNotFoundException(
                        $"None of the requested submissions were found: {string.Join(", ", requestedIds)}");
                }

                var warnings = new List<string>();
                foreach (var missing in requestedIds.Except(submissions.Select(s => s.Id), StringComparer.Ordinal))
                {
                    warnings.Add($"Submission not found and skipped: {missing}");
                    _logger.LogWarning("PDF {PdfRequestId} - submission not found and skipped: {SubmissionId}",
                        requestId, missing);
                }

                var (documents, formTitle) = await BuildDocumentsAsync(submissions, warnings, formIds, tenantIds);
                if (documents.Count == 0)
                {
                    throw new InvalidOperationException(
                        "No submission could be rendered - the related form schema could not be loaded.");
                }

                // Applied here as well as in the engine so the harness measures page breaks
                // against the same (widened) layout Chromium will print.
                var page = (request.Page ?? _settings.Page.Clone())
                    .ApplyMinimumContentWidth(_settings.MinContentWidthPx);

                var options = new PdfGenerationOptions
                {
                    Page = page,
                    HeaderFooter = request.HeaderFooter ?? _settings.HeaderFooter.Clone(),
                    Title = formTitle,
                    TimeoutMs = _settings.RenderTimeoutMs,
                    GeneratedAt = DateTimeOffset.Now,
                    FileName = BuildFileName(request, documents, formTitle)
                };

                var payload = new FormRenderPayload
                {
                    Documents = documents,
                    Options = new FormRenderOptions
                    {
                        ExpandCollapsible = request.ExpandCollapsible,
                        ShowDocumentTitle = request.ShowDocumentTitle,
                        ShowSubmissionMeta = request.ShowSubmissionMeta,
                        FlattenInputs = request.FlattenInputs,
                        TabPageBreak = tabPageBreak,
                        ShowTabTitles = request.ShowTabTitles,
                        ApplyPageBreakRules = true,
                        UsablePageHeightPx = options.Page.PrintableHeightPx(),
                        SettleDelayMs = _settings.RenderSettleDelayMs
                    }
                };

                var source = new FormioContentSource(
                    _assets.HarnessUrl,
                    JsonSerializer.Serialize(payload, PayloadJsonOptions),
                    _settings.NavigationTimeoutMs,
                    _settings.RenderTimeoutMs,
                    _logger);

                var result = await _pdfEngine.RenderAsync(source, options, cancellationToken);

                result.RequestId = requestId;
                result.DocumentCount = documents.Count;
                result.Warnings.InsertRange(0, warnings);

                stopwatch.Stop();
                _logger.LogInformation(
                    "PDF {PdfRequestId} succeeded | documents={DocumentCount} forms=[{FormIds}] tenants=[{TenantIds}] " +
                    "size={SizeBytes} bytes render={RenderMs} ms total={TotalMs} ms warnings={WarningCount} file={FileName}",
                    requestId, result.DocumentCount, Join(formIds), Join(tenantIds), result.SizeBytes,
                    (long)result.Duration.TotalMilliseconds, stopwatch.ElapsedMilliseconds,
                    result.Warnings.Count, result.FileName);

                return result;
            }
            catch (PdfServiceBusyException ex)
            {
                // Expected backpressure, not a fault - keep it out of the error logs.
                stopwatch.Stop();
                _logger.LogWarning(
                    "PDF {PdfRequestId} rejected as busy after {TotalMs} ms | submissions={SubmissionCount} " +
                    "forms=[{FormIds}] tenants=[{TenantIds}] | {ErrorMessage}",
                    requestId, stopwatch.ElapsedMilliseconds, requestedIds.Count,
                    Join(formIds), Join(tenantIds), ex.Message);
                throw;
            }
            catch (OperationCanceledException)
            {
                stopwatch.Stop();
                _logger.LogInformation(
                    "PDF {PdfRequestId} cancelled by the caller after {TotalMs} ms | submissions={SubmissionCount}",
                    requestId, stopwatch.ElapsedMilliseconds, requestedIds.Count);
                throw;
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex,
                    "PDF {PdfRequestId} failed after {TotalMs} ms | submissions={SubmissionCount} [{SubmissionIds}] " +
                    "forms=[{FormIds}] tenants=[{TenantIds}] error={ErrorType}: {ErrorMessage}",
                    requestId, stopwatch.ElapsedMilliseconds, requestedIds.Count, string.Join(",", requestedIds),
                    Join(formIds), Join(tenantIds), ex.GetType().Name, ex.Message);
                throw;
            }
        }

        /// <summary>
        /// Trim, drop blanks, remove duplicates (the same submission twice would be rendered
        /// twice) and cap the batch size. Throws <see cref="ArgumentException"/>, which the
        /// controller reports as 400.
        /// </summary>
        private List<string> ValidateSubmissionIds(List<string>? submissionIds)
        {
            var requestedIds = (submissionIds ?? new List<string>())
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToList();

            // No paramName on these: the message is shown to the end user, and
            // ArgumentException would append "(Parameter 'submissionIds')" to it.
            if (requestedIds.Count == 0)
            {
                throw new ArgumentException("At least one submissionId is required.");
            }

            var maxPerRequest = Math.Max(1, _settings.MaxSubmissionsPerRequest);
            if (requestedIds.Count > maxPerRequest)
            {
                throw new ArgumentException(
                    $"Too many submissions in one request: {requestedIds.Count}. " +
                    $"The maximum is {maxPerRequest} - please export them in smaller batches.");
            }

            return requestedIds;
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

        private static string Join(IEnumerable<string> values) => string.Join(",", values);

        /// <summary>
        /// Pair every submission with its form schema. Each form is loaded once, however many
        /// submissions reference it.
        /// </summary>
        private async Task<(List<FormRenderDocument> Documents, string? FormTitle)> BuildDocumentsAsync(
            IEnumerable<FormSubmission> submissions,
            List<string> warnings,
            HashSet<string> formIds,
            HashSet<string> tenantIds)
        {
            var documents = new List<FormRenderDocument>();
            var formCache = new Dictionary<string, FormDto?>(StringComparer.Ordinal);
            string? firstFormTitle = null;

            foreach (var submission in submissions)
            {
                var formId = submission.FormId;
                if (string.IsNullOrWhiteSpace(formId))
                {
                    warnings.Add($"Submission {submission.Id} has no form id and was skipped.");
                    continue;
                }

                formIds.Add(formId);

                if (!formCache.TryGetValue(formId, out var form))
                {
                    form = await _formService.GetFormByIdAsync(formId);
                    formCache[formId] = form;
                }

                if (form == null)
                {
                    warnings.Add($"Form {formId} was not found - submission {submission.Id} was skipped.");
                    _logger.LogWarning("Form {FormId} not found for submission {SubmissionId}", formId, submission.Id);
                    continue;
                }

                if (form.TenantId.HasValue)
                {
                    tenantIds.Add(form.TenantId.Value.ToString());
                }

                var title = !string.IsNullOrWhiteSpace(form.Title) ? form.Title : form.Name;
                firstFormTitle ??= title;

                documents.Add(new FormRenderDocument
                {
                    Id = submission.Id,
                    Title = title,
                    FormSchema = form,
                    Submission = submission,
                    Meta = new FormRenderDocumentMeta
                    {
                        SubmissionId = submission.Id,
                        FormName = form.Name,
                        SubmittedOn = submission.Created == default
                            ? null
                            : submission.Created.ToLocalTime().ToString("dd MMM yyyy HH:mm"),
                        Version = (submission.FormVersionId > 0 ? submission.FormVersionId : form.VersionId).ToString()
                    }
                });
            }

            return (documents, firstFormTitle);
        }

        private static string BuildFileName(
            FormPdfRequest request,
            IReadOnlyCollection<FormRenderDocument> documents,
            string? formTitle)
        {
            if (!string.IsNullOrWhiteSpace(request.FileName))
            {
                var provided = Sanitize(request.FileName!);
                return provided.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? provided : provided + ".pdf";
            }

            var baseName = Sanitize(string.IsNullOrWhiteSpace(formTitle) ? "form" : formTitle!);

            // Millisecond precision: several batches can be queued from the UI within the
            // same second, and second-resolution names would collide.
            return documents.Count == 1
                ? $"{baseName}_{Sanitize(documents.First().Id ?? "submission")}.pdf"
                : $"{baseName}_submissions_{DateTime.Now:yyyyMMddHHmmssfff}.pdf";
        }

        private static string Sanitize(string value)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var cleaned = new string(value.Select(c => invalid.Contains(c) || c == ' ' ? '_' : c).ToArray());
            return string.IsNullOrWhiteSpace(cleaned) ? "document" : cleaned;
        }
    }
}
