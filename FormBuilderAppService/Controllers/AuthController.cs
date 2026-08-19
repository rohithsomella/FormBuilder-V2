using System.Security.Claims;
using FormBuilderAppService.Models.DTOs.Auth;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FormBuilderAppService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        /// <summary>
        /// The one message returned for every kind of failed login. Deliberately does not
        /// distinguish "no such user" from "wrong password".
        /// </summary>
        private const string InvalidCredentialsMessage = "Invalid username or password.";

        private readonly IAuthService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(
            IAuthService authService,
            ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
        }

        /// <summary>
        /// The single login endpoint. Accepts a username or an email in LoginIdentifier;
        /// the role in the returned token is whatever Identity says it is.
        /// </summary>
        [AllowAnonymous]
        [HttpPost("login")]
        [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (request is null ||
                string.IsNullOrWhiteSpace(request.LoginIdentifier) ||
                string.IsNullOrEmpty(request.Password))
            {
                // Same 401 and same message as a bad password. A missing field must not
                // be distinguishable from a wrong one.
                return Unauthorized(new { message = InvalidCredentialsMessage });
            }

            try
            {
                var response = await _authService.LoginAsync(request);

                if (response is null)
                {
                    return Unauthorized(new { message = InvalidCredentialsMessage });
                }

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error during login.");
                return StatusCode(StatusCodes.Status500InternalServerError,
                    new { message = "An error occurred while processing your request." });
            }
        }

        /// <summary>
        /// The authoritative "who am I". Requires a valid token and reads the user id
        /// from it, so a client cannot ask about somebody else by changing a parameter.
        /// </summary>
        [Authorize]
        [HttpGet("me")]
        [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> Me()
        {
            var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!Guid.TryParse(userIdClaim, out var userId))
            {
                return Unauthorized(new { message = "Invalid token." });
            }

            var user = await _authService.GetUserByIdAsync(userId);

            if (user is null)
            {
                // Token is validly signed but the account is gone - treat as unauthenticated.
                return Unauthorized(new { message = "Invalid token." });
            }

            return Ok(user);
        }

        /// <summary>
        /// Logout. With stateless JWTs the token is discarded by the client; this exists
        /// so the frontend has one endpoint to call and so V2 can add server-side
        /// revocation here without changing the client.
        /// </summary>
        [Authorize]
        [HttpPost("logout")]
        public IActionResult Logout()
        {
            _logger.LogInformation(
                "User {UserId} logged out.", User.FindFirstValue(ClaimTypes.NameIdentifier));

            return Ok(new { message = "Logged out." });
        }

        /// <summary>
        /// Exists so the Admin-only path is genuinely exercisable: no token gives 401, a
        /// User token gives 403, an Admin token gives 200.
        /// </summary>
        [Authorize(Roles = RoleNames.Admin)]
        [HttpGet("admin-check")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public IActionResult AdminCheck() => Ok(new
        {
            message = "Admin access confirmed.",
            userName = User.Identity?.Name,
            roles = User.FindAll(ClaimTypes.Role).Select(c => c.Value)
        });
    }
}
