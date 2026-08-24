using FormBuilderAppService.Pdf;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace FormBuilderAppService.Controllers
{
    /// <summary>
    /// Reusable PDF generation API.
    ///
    /// Any application - the Form Builder UI, a mobile app, a background job or a future
    /// project - can call these endpoints. The response is always the PDF itself, so a
    /// caller can stream it straight to disk or show it in a viewer.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    // Deliberately no class-level [Produces("application/pdf")]: it would make content
    // negotiation reject the JSON error bodies below with an empty 406, so a caller could
    // never see why a PDF failed. File(...) sets the PDF content type explicitly instead.
    // Every endpoint on this controller requires a valid JWT. The frontend attaches it
    // automatically (see the $.ajaxPrefilter in app/js/auth.js), so no page had to change.
    // A request without a token gets 401 regardless of what the browser UI allows.
    [Authorize]
    public class PdfController : ControllerBase
    {
        private const string PdfContentType = "application/pdf";

        private readonly IFormPdfService _formPdfService;
        private readonly IAcroFormPdfService _acroFormPdfService;
        private readonly IPdfEngine _pdfEngine;
        private readonly ILogger<PdfController> _logger;

        public PdfController(
            IFormPdfService formPdfService,
            IAcroFormPdfService acroFormPdfService,
            IPdfEngine pdfEngine,
            ILogger<PdfController> logger)
        {
            _formPdfService = formPdfService;
            _acroFormPdfService = acroFormPdfService;
            _pdfEngine = pdfEngine;
            _logger = logger;
        }

        /// <summary>
        /// Render one or more form submissions into a single PDF.
        /// Each submission starts on a new page and page numbering runs across the
        /// whole document.
        /// </summary>
        /// <param name="request">Submission ids plus optional paper/header/footer overrides.</param>
        /// <param name="download">true returns the PDF as an attachment, false (default) inline.</param>
        [HttpPost("form-submissions")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<IActionResult> GenerateFormSubmissionsPdf(
            [FromBody] FormPdfRequest request,
            [FromQuery] bool download = false,
            CancellationToken cancellationToken = default)
        {
            return await GenerateAsync(() => _formPdfService.GenerateAsync(request, cancellationToken), download);
        }

        /// <summary>
        /// Render a single submission using the default settings. Convenient for mobile
        /// clients and direct links.
        /// </summary>
        [HttpGet("form-submissions/{submissionId}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<IActionResult> GenerateFormSubmissionPdf(
            string submissionId,
            [FromQuery] bool download = false,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(submissionId))
            {
                return BadRequest(new { message = "submissionId is required" });
            }

            return await GenerateAsync(() => _formPdfService.GenerateAsync(submissionId, cancellationToken), download);
        }

        /// <summary>
        /// Render a form definition as a fillable AcroForm PDF: the Preview page exactly as
        /// the read-only PDF prints it, with a real, editable PDF form field over every
        /// textbox, checkbox, radio, dropdown, textarea and signature area.
        /// </summary>
        /// <param name="request">Form id plus optional paper/header/footer overrides.</param>
        /// <param name="download">true returns the PDF as an attachment, false (default) inline.</param>
        [HttpPost("acroform")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<IActionResult> GenerateAcroFormPdf(
            [FromBody] AcroFormPdfRequest request,
            [FromQuery] bool download = false,
            CancellationToken cancellationToken = default)
        {
            return await GenerateAsync(() => _acroFormPdfService.GenerateAsync(request, cancellationToken), download);
        }

        /// <summary>
        /// Fillable AcroForm PDF for a single form using the default settings. Convenient for
        /// direct links and mobile clients.
        /// </summary>
        [HttpGet("acroform/{formId}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<IActionResult> GenerateAcroFormPdf(
            string formId,
            [FromQuery] bool download = false,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(formId))
            {
                return BadRequest(new { message = "formId is required" });
            }

            return await GenerateAsync(() => _acroFormPdfService.GenerateAsync(formId, cancellationToken), download);
        }

        /// <summary>
        /// Report whether Chromium and the rendering assets are ready. Useful as a
        /// deployment smoke test.
        ///
        /// Left anonymous so load balancers and monitoring can probe it without a token.
        /// It reports readiness only - no form, submission or user data.
        /// </summary>
        [AllowAnonymous]
        [HttpGet("health")]
        [Produces("application/json")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
        public async Task<IActionResult> GetHealth(CancellationToken cancellationToken)
        {
            var health = await _pdfEngine.CheckHealthAsync(cancellationToken);
            return health.IsHealthy
                ? Ok(health)
                : StatusCode(StatusCodes.Status503ServiceUnavailable, health);
        }

        private async Task<IActionResult> GenerateAsync(Func<Task<PdfResult>> generate, bool download)
        {
            try
            {
                var result = await generate();

                if (result.Warnings.Count > 0)
                {
                    _logger.LogInformation("PDF generated with {Count} warning(s): {Warnings}",
                        result.Warnings.Count, string.Join(" | ", result.Warnings.Take(10)));
                }

                Response.Headers[HeaderNames.ContentDisposition] = new ContentDispositionHeaderValue(
                    download ? "attachment" : "inline")
                {
                    FileNameStar = result.FileName
                }.ToString();

                // Exposed through CORS so the browser can name the downloaded file.
                Response.Headers["X-Pdf-Filename"] = result.FileName;
                Response.Headers["X-Pdf-Document-Count"] = result.DocumentCount.ToString();
                Response.Headers["X-Pdf-Request-Id"] = result.RequestId;

                return File(result.Content, PdfContentType);
            }
            catch (PdfServiceBusyException ex)
            {
                // Every render slot is taken. Answer straight away with a retry hint instead
                // of leaving the caller queued until the HTTP timeout fires.
                Response.Headers[HeaderNames.RetryAfter] = ex.RetryAfterSeconds.ToString();
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                _logger.LogWarning(ex, "Invalid PDF request");
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "PDF source data not found");
                return NotFound(new { message = ex.Message });
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("PDF generation was cancelled by the caller");
                return StatusCode(StatusCodes.Status499ClientClosedRequest);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ PDF generation failed");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "PDF generation failed.", error = ex.Message });
            }
        }
    }
}
