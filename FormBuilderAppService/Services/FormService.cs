using FormBuilderAppService.Models;
using FormBuilderAppService.Models.DTOs;
using FormBuilderAppService.Repositories.Interfaces;
using FormBuilderAppService.Services.Interfaces;

namespace FormBuilderAppService.Services
{
    public class FormService : IFormService
    {
        private readonly IFormRepository _formRepository;

        public FormService(IFormRepository formRepository)
        {
            _formRepository = formRepository;
        }

        public async Task<List<FormDto>> GetFormsAsync()
        {
            return await _formRepository.GetFormsAsync();
        }

        public async Task<FormDto?> GetFormByIdAsync(string id)
        {
            return await _formRepository.GetFormByIdAsync(id);
        }

        public async Task<string> SaveFormAsync(FormDto model)
        {
            return await _formRepository.SaveFormAsync(model);
        }

        public async Task UpdateFormAsync(FormDto model)
        {
            await _formRepository.UpdateFormAsync(model);
        }

        public async Task DeleteFormAsync(string id)
        {
            await _formRepository.DeleteFormAsync(id);
        }
    }
}