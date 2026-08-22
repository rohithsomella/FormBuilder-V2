using FormBuilderAppService.Models.DTOs.Users;

namespace FormBuilderAppService.Services.Interfaces
{
    /// <summary>
    /// Administration of user accounts: listing them for the User Details table and
    /// creating new ones from the "Add New User" dialog.
    ///
    /// Kept separate from IAuthService on purpose. That one answers "who is calling and
    /// are they who they say they are"; this one is an admin managing other people's
    /// accounts. Mixing them would put an account-creation path inside the class that
    /// handles anonymous login requests.
    /// </summary>
    public interface IUserManagementService
    {
        /// <summary>
        /// Every account with its roles, newest first.
        /// </summary>
        Task<List<UserListItemDto>> GetUsersAsync();

        /// <summary>
        /// The roles the dialog may offer: every non-deleted row in AspNetRoles. Roles
        /// are data, not a compiled list, so one added by SQL is assignable immediately.
        /// </summary>
        Task<List<RoleOptionDto>> GetAssignableRolesAsync();

        /// <summary>
        /// Backs the "Verify" button beside the username box. Reports both "that is not a
        /// usable username" and "somebody already has it".
        /// </summary>
        Task<UserNameAvailabilityDto> CheckUserNameAsync(string? userName);

        /// <summary>
        /// Validates the request, creates the account in AspNetUsers with a generated
        /// password, and assigns the requested roles. Returns the reasons rather than
        /// throwing when the request is rejected.
        /// </summary>
        /// <param name="createdBy">
        /// Username of the admin performing the create, recorded in AspNetUsers.CreatedBy.
        /// Taken from the validated token by the controller - never from the request body,
        /// which would let a caller claim somebody else made the account.
        /// </param>
        Task<CreateUserResult> CreateUserAsync(CreateUserRequest request, string createdBy);
    }
}
