using FormBuilderAppService.Models;
using FormBuilderAppService.Models.DTOs;

namespace FormBuilderAppService.Repositories.Interfaces
{
    public interface IFormRepository
    {
        Task<List<FormDto>> GetFormsAsync();

        Task<FormDto?> GetFormByIdAsync(string id);

        Task<string> SaveFormAsync(FormDto model);

        Task UpdateFormAsync(FormDto model);

        Task DeleteFormAsync(string id);
    }
}