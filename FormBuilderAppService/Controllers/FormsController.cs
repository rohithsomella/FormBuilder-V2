using FormBuilderAppService.Models.DTOs;
using FormBuilderAppService.Services;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // Every endpoint on this controller requires a valid JWT. The frontend attaches it
    // automatically (see the $.ajaxPrefilter in app/js/auth.js), so no page had to change.
    // A request without a token gets 401 regardless of what the browser UI allows.
    [Authorize]
    public class FormsController : ControllerBase
    {
        private readonly IFormService _formService;
        private readonly ILogger<FormsController> _logger;

        public FormsController(
            IFormService formService,
            ILogger<FormsController> logger)
        {
            _formService = formService;
            _logger = logger;
        }

        /// <summary>
        /// Get all forms
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<List<FormDto>>> GetForms()
        {
            try
            {
                _logger.LogInformation("Fetching all forms.");

                var forms = await _formService.GetFormsAsync();

                _logger.LogInformation("Successfully fetched {Count} forms.", forms.Count);

                return Ok(forms);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while fetching forms.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving forms." });
            }
        }

        /// <summary>
        /// Get form by MongoDB Id
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<FormDto>> GetFormById(string id)
        {
            try
            {
                _logger.LogInformation("Fetching form with Id: {Id}", id);

                var form = await _formService.GetFormByIdAsync(id);

                if (form == null)
                {
                    _logger.LogWarning("Form not found. Id: {Id}", id);

                    return NotFound(new { message = "Form not found." });
                }

                _logger.LogInformation("Form fetched successfully. Id: {Id}", id);

                return Ok(form);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while fetching form. Id: {Id}", id);

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving the form." });
            }
        }

        /// <summary>
        /// Save a new form
        /// </summary>
        [HttpPost]
        public async Task<ActionResult> SaveForm([FromBody] FormDto model)
        {
            try
            {
                if (model == null)
                {
                    _logger.LogWarning("Save form request received with null model.");

                    return BadRequest(new { message = "Form data is required." });
                }

                _logger.LogInformation("Saving new form: {Title}", model.Title);

                var id = await _formService.SaveFormAsync(model);

                _logger.LogInformation("Form saved successfully. Id: {Id}", id);

                return Ok(new
                {
                    message = "Form saved successfully.",
                    id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while saving form.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while saving the form." });
            }
        }

        /// <summary>
        /// Update an existing form
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateForm(string id, [FromBody] FormDto model)
        {
            try
            {
                if (model == null)
                {
                    _logger.LogWarning("Update form request received with null model.");

                    return BadRequest(new { message = "Form data is required." });
                }

                model.Id = id;

                var existingForm = await _formService.GetFormByIdAsync(id);

                if (existingForm == null)
                {
                    _logger.LogWarning("Form not found for update. Id: {Id}", id);

                    return NotFound(new { message = "Form not found." });
                }

                await _formService.UpdateFormAsync(model);

                _logger.LogInformation("Form updated successfully. Id: {Id}", id);

                return Ok(new
                {
                    message = "Form updated successfully.",
                    id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating form. Id: {Id}", id);

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while updating the form." });
            }
        }

        /// <summary>
        /// Delete a form
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteForm(string id)
        {
            try
            {
                var existingForm = await _formService.GetFormByIdAsync(id);

                if (existingForm == null)
                {
                    _logger.LogWarning("Form not found for deletion. Id: {Id}", id);

                    return NotFound(new { message = "Form not found." });
                }

                await _formService.DeleteFormAsync(id);

                _logger.LogInformation("Form deleted successfully. Id: {Id}", id);

                return Ok(new
                {
                    message = "Form deleted successfully.",
                    id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting form. Id: {Id}", id);

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while deleting the form." });
            }
        }

        /// <summary>
        /// Get all forms by Tenant Id
        /// </summary>
        [HttpGet("{id}/tenantForms")]

        public ActionResult<List<FormDto>> GetFormsByTenantId(Guid id)
        {
            try
            {
                var forms = _formService.GetFormsByTenantId(id);
                return Ok(forms);
            }
            
            catch (Exception ex)
            {
                _logger.LogError(ex, ex.Message);

                return StatusCode(500, new
                {
                    message = ex.Message,
                    inner = ex.InnerException?.Message
                });
            }
        }


    }
}