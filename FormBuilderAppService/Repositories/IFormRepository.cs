using FormBuilderAppService.Models;

namespace FormBuilderAppService.Repositories
{
    public interface IFormRepository
    {
        List<Form> GetForms();
        Form GetFormById(Guid formId);
        void SaveForm(Form model);
    }
}
