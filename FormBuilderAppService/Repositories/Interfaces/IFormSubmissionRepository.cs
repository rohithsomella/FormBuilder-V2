using FormBuilderAppService.Models;

namespace FormBuilderAppService.Repositories.Interfaces
{
    public interface IFormSubmissionRepository
    {
        Guid SaveFormSubmission(Guid formId, string submissionData);
        List<FormSubmission> GetFormSubmissions(Guid formId);
        FormSubmission? GetFormSubmissionById(Guid submissionId);
    }
}
