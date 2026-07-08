using FormBuilderAppService.Models;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;
using System.Text.Json;

namespace FormBuilderAppService.Services
{
    public class FormSubmissionService : IFormSubmissionService
    {
        private readonly IFormSubmissionRepository _formSubmissionRepository;

        public FormSubmissionService(IFormSubmissionRepository formSubmissionRepository)
        {
            _formSubmissionRepository = formSubmissionRepository;
        }

        public async Task<string> SaveFormSubmissionAsync(JsonElement submission)
        {
            return await _formSubmissionRepository.SaveFormSubmissionAsync(submission);
        }

        public async Task<List<FormSubmission>> GetFormSubmissionsAsync(string formId)
        {
            return await _formSubmissionRepository.GetFormSubmissionsAsync(formId);
        }

        public async Task<FormSubmission?> GetFormSubmissionByIdAsync(string submissionId)
        {
            return await _formSubmissionRepository.GetFormSubmissionByIdAsync(submissionId);
        }
    }
}
