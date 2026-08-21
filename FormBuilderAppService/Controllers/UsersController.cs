using FormBuilderAppService.Models.DTOs.Auth;
using FormBuilderAppService.Models.DTOs.Users;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // Managing accounts is an Admin job, and this attribute - not the browser UI - is
    // what enforces it. Hiding the "Add New User" button from a non-admin is a courtesy;
    // a request from one gets 403 here regardless of what their page showed them.
    [Authorize(Roles = RoleNames.Admin)]
    public class UsersController : ControllerBase
    {
        private readonly IUserManagementService _userManagementService;
        private readonly ILogger<UsersController> _logger;

        public UsersController(
            IUserManagementService userManagementService,
            ILogger<UsersController> logger)
        {
            _userManagementService = userManagementService;
            _logger = logger;
        }

        /// <summary>
        /// Every account, for the User Details table.
        /// </summary>
        [HttpGet]
        [ProducesResponseType(typeof(List<UserListItemDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var users = await _userManagementService.GetUsersAsync();

                _logger.LogInformation("Successfully fetched {Count} users.", users.Count);

                return Ok(users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while fetching users.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving users." });
            }
        }

        /// <summary>
        /// The roles the "Add New User" dialog offers. Fetched rather than hard-coded in
        /// the page so adding a role to the backend shows up in the dropdown by itself.
        /// </summary>
        [HttpGet("roles")]
        [ProducesResponseType(typeof(List<RoleOptionDto>), StatusCodes.Status200OK)]
        public async Task<IActionResult> GetRoles()
        {
            try
            {
                var roles = await _userManagementService.GetAssignableRolesAsync();
                return Ok(roles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while fetching assignable roles.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while retrieving roles." });
            }
        }

        /// <summary>
        /// Backs the "Verify" button beside the username box.
        ///
        /// Always 200 - "that name is taken" is a successful answer to the question, not
        /// a failed request. The body carries the verdict.
        /// </summary>
        [HttpGet("username-availability")]
        [ProducesResponseType(typeof(UserNameAvailabilityDto), StatusCodes.Status200OK)]
        public async Task<IActionResult> CheckUserName([FromQuery] string? userName)
        {
            try
            {
                var availability = await _userManagementService.CheckUserNameAsync(userName);
                return Ok(availability);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while checking username availability.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while checking the username." });
            }
        }

        /// <summary>
        /// Creates an account in AspNetUsers and assigns its roles.
        ///
        /// The 201 body carries the generated one-time password. That is the only time it
        /// is ever readable - it is stored only as a hash - so the dialog must show it to
        /// the admin before they close it.
        /// </summary>
        [HttpPost]
        [ProducesResponseType(typeof(CreateUserResponse), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            if (request is null)
            {
                return BadRequest(new { message = "No user details were supplied." });
            }

            try
            {
                // Read from the validated token, the same way TenantController takes
                // deletedBy. A CreatedBy supplied in the body would be unverifiable.
                var createdBy = User.Identity?.Name ?? "System";

                var result = await _userManagementService.CreateUserAsync(request, createdBy);

                if (!result.Succeeded)
                {
                    // message is what the dialog shows; errors carries the rest so a
                    // request that got several things wrong reports all of them.
                    return BadRequest(new
                    {
                        message = result.Errors.FirstOrDefault() ?? "Could not create the user.",
                        errors = result.Errors
                    });
                }

                var created = result.Created!;

                return CreatedAtAction(
                    nameof(GetUsers),
                    new { id = created.User.UserId },
                    created);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while creating a user.");

                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while creating the user." });
            }
        }
    }
}
