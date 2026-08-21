using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using FormBuilderAppService.Models.DTOs.Auth;
using FormBuilderAppService.Models.DTOs.Users;
using FormBuilderAppService.Models.Identity;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FormBuilderAppService.Services
{
    /// <summary>
    /// User administration. All the rules about what makes an acceptable new account
    /// live here; the repository only reads and writes, and the controller only turns
    /// the outcome into a status code.
    /// </summary>
    public class UserManagementService : IUserManagementService
    {
        /// <summary>
        /// Identity's default User.AllowedUserNameCharacters, plus a length bound. The
        /// pre-check exists so the dialog can say "that character is not allowed" instead
        /// of surfacing Identity's InvalidUserName error after a round trip; Identity
        /// still validates on create, so this cannot let a bad name through.
        /// </summary>
        private static readonly Regex UserNamePattern =
            new(@"^[A-Za-z0-9._@+\-]{3,50}$", RegexOptions.Compiled);

        private static readonly EmailAddressAttribute EmailValidator = new();

        private readonly IUserRepository _userRepository;
        private readonly ILogger<UserManagementService> _logger;

        public UserManagementService(
            IUserRepository userRepository,
            ILogger<UserManagementService> logger)
        {
            _userRepository = userRepository;
            _logger = logger;
        }

        public async Task<List<UserListItemDto>> GetUsersAsync()
        {
            var users = await _userRepository.GetUsersAsync();
            var rolesByUserId = await _userRepository.GetRoleNamesByUserIdAsync();

            return users.Select(user => ToListItem(
                user,
                rolesByUserId.TryGetValue(user.Id, out var roles) ? roles : new List<string>()))
                .ToList();
        }

        public async Task<List<RoleOptionDto>> GetAssignableRolesAsync()
        {
            var existingRoles = await _userRepository.GetRolesAsync();

            // Driven by RoleNames.All rather than by whatever happens to be in the table,
            // so the dropdown lists the roles in a stable, intended order and never
            // offers a stray row somebody added to AspNetRoles by hand.
            return RoleNames.All
                .Select(roleName => new
                {
                    Name = roleName,
                    Match = existingRoles.FirstOrDefault(
                        r => string.Equals(r.Name, roleName, StringComparison.OrdinalIgnoreCase))
                })
                .Where(entry => entry.Match is not null)
                .Select(entry => new RoleOptionDto
                {
                    Name = entry.Name,
                    Description = entry.Match!.Description
                })
                .ToList();
        }

        public async Task<UserNameAvailabilityDto> CheckUserNameAsync(string? userName)
        {
            var candidate = userName?.Trim() ?? string.Empty;

            var formatError = ValidateUserNameFormat(candidate);

            if (formatError is not null)
            {
                return new UserNameAvailabilityDto
                {
                    UserName = candidate,
                    IsAvailable = false,
                    Message = formatError
                };
            }

            var existing = await _userRepository.FindByUserNameAsync(candidate);

            return new UserNameAvailabilityDto
            {
                UserName = candidate,
                IsAvailable = existing is null,
                Message = existing is null
                    ? $"'{candidate}' is available."
                    : $"'{candidate}' is already taken."
            };
        }

        public async Task<CreateUserResult> CreateUserAsync(CreateUserRequest request, string createdBy)
        {
            if (request is null)
            {
                return CreateUserResult.Failure("No user details were supplied.");
            }

            var firstName = request.FirstName?.Trim() ?? string.Empty;
            var lastName = request.LastName?.Trim() ?? string.Empty;
            var userName = request.UserName?.Trim() ?? string.Empty;
            var email = request.Email?.Trim() ?? string.Empty;

            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(firstName))
            {
                errors.Add("First name is required.");
            }
            else if (firstName.Length > 100)
            {
                errors.Add("First name cannot be longer than 100 characters.");
            }

            if (string.IsNullOrWhiteSpace(lastName))
            {
                errors.Add("Last name is required.");
            }
            else if (lastName.Length > 100)
            {
                errors.Add("Last name cannot be longer than 100 characters.");
            }

            var userNameError = ValidateUserNameFormat(userName);
            if (userNameError is not null)
            {
                errors.Add(userNameError);
            }

            if (string.IsNullOrWhiteSpace(email))
            {
                errors.Add("Email is required.");
            }
            else if (!EmailValidator.IsValid(email))
            {
                errors.Add($"'{email}' is not a valid email address.");
            }

            var roles = NormalizeRoles(request.Roles, errors);

            if (errors.Count > 0)
            {
                return CreateUserResult.Failure(errors);
            }

            // Checked before the insert so the dialog gets a sentence it can show, rather
            // than Identity's DuplicateUserName/DuplicateEmail codes. The unique indexes
            // on AspNetUsers remain the actual guarantee.
            if (await _userRepository.FindByUserNameAsync(userName) is not null)
            {
                return CreateUserResult.Failure($"Username '{userName}' is already taken.");
            }

            if (await _userRepository.FindByEmailAsync(email) is not null)
            {
                return CreateUserResult.Failure($"Email '{email}' is already registered.");
            }

            // One timestamp for both columns rather than two DateTime.Now calls, so a row
            // never looks as though it was modified a tick after it was created.
            var now = DateTime.Now;
            var actor = string.IsNullOrWhiteSpace(createdBy) ? "System" : createdBy.Trim();

            var user = new ApplicationUser
            {
                UserName = userName,
                Email = email,
                FirstName = firstName,
                LastName = lastName,
                FullName = $"{firstName} {lastName}".Trim(),

                Created = now,
                CreatedBy = actor,

                // Updated/UpdatedBy mirror the create rather than staying empty, so
                // "who last touched this row" is answerable from the moment it exists.
                Updated = now,
                UpdatedBy = actor,

                IsDeleted = false,
                IsActive = true,

                // There is no mail sender in this version, so requiring a confirmation
                // click would make every created account unusable.
                EmailConfirmed = true
            };

            var temporaryPassword = TemporaryPasswordGenerator.Generate();

            var createResult = await _userRepository.CreateAsync(user, temporaryPassword);

            if (!createResult.Succeeded)
            {
                _logger.LogWarning(
                    "Failed to create user '{UserName}': {Errors}",
                    userName, Describe(createResult));

                return CreateUserResult.Failure(createResult.Errors.Select(e => e.Description));
            }

            var roleResult = await _userRepository.AddToRolesAsync(user, roles);

            if (!roleResult.Succeeded)
            {
                // A user with no roles can sign in but can do nothing, and the admin gets
                // an error implying nothing was created. Removing the row keeps those two
                // stories consistent - the create either fully happened or did not.
                _logger.LogError(
                    "Assigning roles to new user '{UserName}' failed ({Errors}); removing the account.",
                    userName, Describe(roleResult));

                await _userRepository.DeleteAsync(user);

                return CreateUserResult.Failure(roleResult.Errors.Select(e => e.Description));
            }

            _logger.LogInformation(
                "Created user '{UserName}' ({UserId}) with roles [{Roles}].",
                userName, user.Id, string.Join(", ", roles));

            return CreateUserResult.Success(new CreateUserResponse
            {
                User = ToListItem(user, roles),
                TemporaryPassword = temporaryPassword
            });
        }

        /// <summary>
        /// Maps the submitted role names onto the canonical ones and rejects anything
        /// unrecognised. This is what stops a hand-crafted request from assigning a role
        /// the application does not define.
        /// </summary>
        private static List<string> NormalizeRoles(IEnumerable<string>? requestedRoles, List<string> errors)
        {
            var roles = new List<string>();

            foreach (var requested in requestedRoles ?? Enumerable.Empty<string>())
            {
                var normalized = RoleNames.Normalize(requested);

                if (normalized is null)
                {
                    errors.Add($"'{requested}' is not a valid role.");
                    continue;
                }

                if (!roles.Contains(normalized))
                {
                    roles.Add(normalized);
                }
            }

            if (roles.Count == 0 && !errors.Any(e => e.EndsWith("is not a valid role.")))
            {
                errors.Add("At least one role must be selected.");
            }

            return roles;
        }

        private static string? ValidateUserNameFormat(string userName)
        {
            if (string.IsNullOrWhiteSpace(userName))
            {
                return "Username is required.";
            }

            if (!UserNamePattern.IsMatch(userName))
            {
                return "Username must be 3-50 characters and may only contain letters, " +
                       "digits and . _ - @ +";
            }

            return null;
        }

        private static UserListItemDto ToListItem(ApplicationUser user, IEnumerable<string> roles)
        {
            var fullName = !string.IsNullOrWhiteSpace(user.FullName)
                ? user.FullName!
                : $"{user.FirstName} {user.LastName}".Trim();

            return new UserListItemDto
            {
                UserId = user.Id,
                UserName = user.UserName ?? string.Empty,

                // Accounts that pre-date the FirstName/LastName columns - the seeded ones -
                // only have FullName, so the table would otherwise show a blank name.
                FirstName = user.FirstName ?? FirstWord(fullName),
                LastName = user.LastName ?? RemainingWords(fullName),

                FullName = fullName,
                Email = user.Email ?? string.Empty,
                Roles = roles.ToList(),
                Created = user.Created
            };
        }

        private static string FirstWord(string value)
        {
            var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return parts.Length > 0 ? parts[0] : string.Empty;
        }

        private static string RemainingWords(string value)
        {
            var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return parts.Length > 1 ? string.Join(' ', parts.Skip(1)) : string.Empty;
        }

        private static string Describe(IdentityResult result) =>
            string.Join("; ", result.Errors.Select(e => $"{e.Code}: {e.Description}"));
    }
}
