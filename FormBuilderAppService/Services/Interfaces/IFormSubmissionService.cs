using FormBuilderAppService.Models;
using System.Text.Json;

namespace FormBuilderAppService.Services.Interfaces
{
    public interface IFormSubmissionService
    {
        /// <summary>
        /// Save a complete Formio submission document.
        /// </summary>
        /// <param name="submission">The complete Formio submission as JsonElement</param>
        /// <returns>The generated submission ID</returns>
        Task<string> SaveFormSubmissionAsync(JsonElement submission);
        
        Task<List<FormSubmission>> GetFormSubmissionsAsync(string formId);
        Task<FormSubmission?> GetFormSubmissionByIdAsync(string submissionId);

        /// <summary>
        /// Fetch several submissions in one round trip, in the order the ids were given.
        /// Ids that do not exist are skipped.
        /// </summary>
        Task<List<FormSubmission>> GetFormSubmissionsByIdsAsync(IEnumerable<string> submissionIds);
    }
}
