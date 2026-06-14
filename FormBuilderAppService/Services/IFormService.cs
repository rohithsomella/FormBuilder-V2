using FormBuilderAppService.Models;

namespace FormBuilderAppService.Services
{
    public interface IFormService
    {
        List<Form> GetForms();
        Form GetFormById(Guid formId);
        void SaveForm(Form model);
    }
}
