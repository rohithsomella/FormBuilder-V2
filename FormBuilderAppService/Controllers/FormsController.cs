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

            _formService.SaveForm(model);
            return Ok(new { message = "Form saved successfully" });
        }
    }
}
