using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // Every endpoint on this controller requires a valid JWT. The frontend attaches it
    // automatically (see the $.ajaxPrefilter in app/js/auth.js), so no page had to change.
    // A request without a token gets 401 regardless of what the browser UI allows.
    [Authorize]
    public class FormSubmissionsController : ControllerBase
    {
        private readonly IFormSubmissionService _formSubmissionService;
        private readonly ILogger<FormSubmissionsController> _logger;

        public FormSubmissionsController(
            IFormSubmissionService formSubmissionService,
            ILogger<FormSubmissionsController> logger)
        {
            _formSubmissionService = formSubmissionService;
            _logger = logger;
        }

        /// <summary>
        /// Save a complete Form.io submission document.
        /// Accepts the entire submission JSON with all properties (data, metadata, owner, roles, access, deleted, etc.)
        /// and stores it as a native MongoDB document.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult> SaveFormSubmission([FromBody] JsonElement submission)
        {
            try
            {
                // Basic validation - submission should not be null/undefined
                if (submission.ValueKind == JsonValueKind.Null || submission.ValueKind == JsonValueKind.Undefined)
                {
                    _logger.LogError("Submission is null or undefined");
                    return BadRequest(new { message = "Submission cannot be null or empty" });
                }

                if (submission.ValueKind != JsonValueKind.Object)
                {
                    _logger.LogError("Submission must be a JSON object");
                    return BadRequest(new { message = "Submission must be a valid JSON object" });
                }

                // Validate form property exists
                if (!submission.TryGetProperty("form", out var formProperty))
                {
                    _logger.LogError("'form' property not found in submission");
                    return BadRequest(new { message = "Submission must contain a 'form' property with the Form ID" });
                }

                var submissionId = await _formSubmissionService.SaveFormSubmissionAsync(submission);

                _logger.LogInformation("✅ Form submission saved: {SubmissionId}", submissionId);

                return Ok(new { message = "Form submission saved successfully", submissionId = submissionId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error saving form submission");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while saving the form submission.", error = ex.Message });
            }
        }

        /// <summary>
        /// Get all submissions for a form
        /// </summary>
        [HttpGet("form/{formId}")]
        public async Task<ActionResult> GetFormSubmissions(string formId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(formId))
                {
                    _logger.LogWarning("GetFormSubmissions: null FormId");
                    return BadRequest(new { message = "FormId is required" });
                }

                var submissions = await _formSubmissionService.GetFormSubmissionsAsync(formId);

                _logger.LogInformation("✅ Fetched {Count} submissions for FormId: {FormId}", submissions.Count, formId);

                return Ok(submissions);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error retrieving form submissions");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving form submissions." });
            }
        }

        /// <summary>
        /// Get a specific submission by ID
        /// </summary>
        [HttpGet("{submissionId}")]
        public async Task<ActionResult> GetFormSubmissionById(string submissionId)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(submissionId))
                {
                    _logger.LogWarning("GetFormSubmissionById: null SubmissionId");
                    return BadRequest(new { message = "SubmissionId is required" });
                }

                var submission = await _formSubmissionService.GetFormSubmissionByIdAsync(submissionId);

                if (submission == null)
                {
                    _logger.LogWarning("Submission not found: {SubmissionId}", submissionId);
                    return NotFound(new { message = "Submission not found" });
                }

                return Ok(submission);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error retrieving form submission: {SubmissionId}", submissionId);

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving the form submission." });
            }
        }
    }
}
