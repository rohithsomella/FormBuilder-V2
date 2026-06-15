using FormBuilderAppService.Models;

namespace FormBuilderAppService.Repositories
{
    public interface IFormRepository
    {
        List<Form> GetForms();
        Form? GetFormById(Guid formId);
        Guid SaveForm(Form model);
        void UpdateForm(Form model);
    }
}
