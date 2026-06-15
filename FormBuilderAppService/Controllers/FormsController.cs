using FormBuilderAppService.Models;
using FormBuilderAppService.Services;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FormsController : ControllerBase
    {
        private readonly IFormService _formService;

        public FormsController(IFormService formService)
        {
            _formService = formService;
        }

        /// <summary>
        /// Get all forms
        /// </summary>
        [HttpGet]
        public ActionResult<List<Form>> GetForms()
        {
            var forms = _formService.GetForms();
            return Ok(forms);
        }

        /// <summary>
        /// Get form by ID
        /// </summary>
        [HttpGet("{id}")]
        public ActionResult<Form> GetFormById(Guid id)
        {
            var form = _formService.GetFormById(id);
            if (form == null)
            {
                return NotFound(new { message = "Form not found" });
            }
            return Ok(form);
        }

        /// <summary>
        /// Save a new form
        /// </summary>
        [HttpPost]
        public ActionResult SaveForm([FromBody] Form model)
        {
            if (model == null)
            {
                return BadRequest(new { message = "Form data is required" });
            }

            var formId = _formService.SaveForm(model);
            return Ok(new { message = "Form saved successfully", formId = formId });
        }

        /// <summary>
        /// Update an existing form
        /// </summary>
        [HttpPut("{id}")]
        public ActionResult UpdateForm(Guid id, [FromBody] Form model)
        {
            if (model == null)
            {
                return BadRequest(new { message = "Form data is required" });
            }

            if (id != model.FormId && model.FormId == Guid.Empty)
            {
                model.FormId = id;
            }

            if (id != model.FormId)
            {
                return BadRequest(new { message = "Form ID mismatch" });
            }

            var existingForm = _formService.GetFormById(id);
            if (existingForm == null)
            {
                return NotFound(new { message = "Form not found" });
            }

            _formService.UpdateForm(model);
            return Ok(new { message = "Form updated successfully", formId = id });
        }
    }
}
