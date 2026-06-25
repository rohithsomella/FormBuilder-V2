using FormBuilderAppService.Models;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ResourcesController : ControllerBase
    {
        private readonly IResourceService _resourceService;

        public ResourcesController(IResourceService resourceService)
        {
            _resourceService = resourceService;
        }

        /// <summary>
        /// Get all resources
        /// </summary>
        [HttpGet]
        public ActionResult<List<Resource>> GetResources()
        {
            var resources = _resourceService.GetResources();
            return Ok(resources);
        }

        /// <summary>
        /// Get resource by ID
        /// </summary>
        [HttpGet("{id}")]
        public ActionResult<Resource> GetResourceById(Guid id)
        {
            var resource = _resourceService.GetResourceById(id);
            if (resource == null)
            {
                return NotFound(new { message = "Resource not found" });
            }
            return Ok(resource);
        }

        /// <summary>
        /// Get all resources grouped by ResourceType
        /// </summary>
        [HttpGet("grouped/list")]
        public ActionResult<List<ResourceGroup>> GetResourcesList()
        {
            var groups = _resourceService.GetResourcesList();
            return Ok(groups);
        }

        /// <summary>
        /// Save a new resource
        /// </summary>
        [HttpPost]
        public ActionResult SaveResource([FromBody] Resource model)
        {
            if (model == null)
            {
                return BadRequest(new { message = "Resource data is required" });
            }

            if (string.IsNullOrEmpty(model.ResourceType))
            {
                return BadRequest(new { message = "Resource Type is required" });
            }

            if (string.IsNullOrEmpty(model.ComponentName))
            {
                return BadRequest(new { message = "Component Name is required" });
            }

            if (string.IsNullOrEmpty(model.ResourceJson))
            {
                return BadRequest(new { message = "Resource JSON is required" });
            }

            try
            {
                var resourceId = _resourceService.SaveResource(model);
                return Ok(new { message = "Resource saved successfully", resourceId = resourceId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error saving resource: {ex.Message}" });
            }
        }

        /// <summary>
        /// Update an existing resource
        /// </summary>
        [HttpPut("{id}")]
        public ActionResult UpdateResource(Guid id, [FromBody] Resource model)
        {
            if (model == null)
            {
                return BadRequest(new { message = "Resource data is required" });
            }

            if (string.IsNullOrEmpty(model.ResourceType))
            {
                return BadRequest(new { message = "Resource Type is required" });
            }

            if (string.IsNullOrEmpty(model.ComponentName))
            {
                return BadRequest(new { message = "Component Name is required" });
            }

            if (id != model.ResourceId && model.ResourceId == Guid.Empty)
            {
                model.ResourceId = id;
            }

            if (id != model.ResourceId)
            {
                return BadRequest(new { message = "Resource ID mismatch" });
            }

            var existingResource = _resourceService.GetResourceById(id);
            if (existingResource == null)
            {
                return NotFound(new { message = "Resource not found" });
            }

            try
            {
                _resourceService.UpdateResource(model);
                return Ok(new { message = "Resource updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error updating resource: {ex.Message}" });
            }
        }

        /// <summary>
        /// Delete a resource
        /// </summary>
        [HttpDelete("{id}")]
        public ActionResult DeleteResource(Guid id)
        {
            var resource = _resourceService.GetResourceById(id);
            if (resource == null)
            {
                return NotFound(new { message = "Resource not found" });
            }

            try
            {
                _resourceService.DeleteResource(id);
                return Ok(new { message = "Resource deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = $"Error deleting resource: {ex.Message}" });
            }
        }
    }
}
