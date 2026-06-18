using FormBuilderAppService.Models;

namespace FormBuilderAppService.Services.Interfaces
{
    public interface IFormSubmissionService
    {
        Guid SaveFormSubmission(Guid formId, string submissionData);
        List<FormSubmission> GetFormSubmissions(Guid formId);
        FormSubmission? GetFormSubmissionById(Guid submissionId);
    }
}
