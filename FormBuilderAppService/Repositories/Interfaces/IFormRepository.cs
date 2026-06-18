using FormBuilderAppService.Models;

namespace FormBuilderAppService.Repositories.Interfaces
{
    public interface IFormRepository
    {
        List<Form> GetForms();
        Form? GetFormById(Guid formId);
        Guid SaveForm(Form model);
        void UpdateForm(Form model);
    }
}
