using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FormSubmissionsController : ControllerBase
    {
        private readonly IFormSubmissionService _formSubmissionService;

        public FormSubmissionsController(IFormSubmissionService formSubmissionService)
        {
            _formSubmissionService = formSubmissionService;
        }

        /// <summary>
        /// Save a form submission
        /// </summary>
        [HttpPost]
        public ActionResult SaveFormSubmission([FromBody] SaveSubmissionRequest request)
        {
            if (request == null || request.FormId == Guid.Empty || string.IsNullOrWhiteSpace(request.SubmissionData))
            {
                return BadRequest(new { message = "FormId and SubmissionData are required" });
            }

            try
            {
                var submissionId = _formSubmissionService.SaveFormSubmission(request.FormId, request.SubmissionData);
                return Ok(new { message = "Form submission saved successfully", submissionId = submissionId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error saving form submission", error = ex.Message });
            }
        }

        /// <summary>
        /// Get all submissions for a form
        /// </summary>
        [HttpGet("form/{formId}")]
        public ActionResult GetFormSubmissions(Guid formId)
        {
            if (formId == Guid.Empty)
            {
                return BadRequest(new { message = "FormId is required" });
            }

            try
            {
                var submissions = _formSubmissionService.GetFormSubmissions(formId);
                return Ok(submissions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving form submissions", error = ex.Message });
            }
        }

        /// <summary>
        /// Get a specific submission by ID
        /// </summary>
        [HttpGet("{submissionId}")]
        public ActionResult GetFormSubmissionById(Guid submissionId)
        {
            if (submissionId == Guid.Empty)
            {
                return BadRequest(new { message = "SubmissionId is required" });
            }

            try
            {
                var submission = _formSubmissionService.GetFormSubmissionById(submissionId);
                if (submission == null)
                {
                    return NotFound(new { message = "Submission not found" });
                }
                return Ok(submission);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving form submission", error = ex.Message });
            }
        }
    }

    /// <summary>
    /// Request model for saving form submissions
    /// </summary>
    public class SaveSubmissionRequest
    {
        public Guid FormId { get; set; }
        public string? SubmissionData { get; set; }
    }
}
