using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;

namespace FormBuilderAppService.Services
{
    public class FormSubmissionService : IFormSubmissionService
    {
        private readonly IFormSubmissionRepository _formSubmissionRepository;

        public FormSubmissionService(IFormSubmissionRepository formSubmissionRepository)
        {
            _formSubmissionRepository = formSubmissionRepository;
        }

        public Guid SaveFormSubmission(Guid formId, string submissionData)
        {
            return _formSubmissionRepository.SaveFormSubmission(formId, submissionData);
        }

        public List<FormSubmission> GetFormSubmissions(Guid formId)
        {
            return _formSubmissionRepository.GetFormSubmissions(formId);
        }

        public FormSubmission? GetFormSubmissionById(Guid submissionId)
        {
            return _formSubmissionRepository.GetFormSubmissionById(submissionId);
        }
    }
}
