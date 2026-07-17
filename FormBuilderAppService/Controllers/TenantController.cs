using FormBuilderAppService.Models;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TenantController : ControllerBase
    {
        private readonly ITenantService _tenantService;
        private readonly ILogger<TenantController> _logger;

        public TenantController(
            ITenantService tenantService,
            ILogger<TenantController> _logger)
        {
            _tenantService = tenantService;
            this._logger = _logger;
        }

        /// <summary>
        /// Get all tenants
        /// </summary>
        [HttpGet]
        public ActionResult<List<Tenant>> GetTenants()
        {
            try
            {
                _logger.LogInformation("Fetching all tenants.");

                var tenants = _tenantService.GetTenants();

                _logger.LogInformation("Successfully fetched {Count} tenants.", tenants.Count);

                return Ok(tenants);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while fetching tenants.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving tenants." });
            }
        }
        
        /// <summary>
        /// Update an existing tenant
        /// </summary>
        [HttpPut("{id}")]

        public IActionResult UpdateTenant(Guid id, [FromBody] Tenant model)
        {
            if (model == null)
            {
                return BadRequest();
            }

            model.TenantId = id;

            _tenantService.UpdateTenant(model);

            return Ok(new
            {
                message = "Tenant updated successfully."
            });
        }
        /// <summary>
        /// Delete a tenant
        /// </summary>
        [HttpDelete("{id}")]
        public IActionResult DeleteTenant(Guid id)
        {
            try
            {
                string deletedBy = User.Identity?.Name ?? "System";
                _tenantService.DeleteTenant(id, deletedBy);
                return Ok(new { message = "Tenant deleted successfully." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting tenant.");
                return StatusCode(500, new { message = "Error deleting tenant." });
            }
        }
    }
}
