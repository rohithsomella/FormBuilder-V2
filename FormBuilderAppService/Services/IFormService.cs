using FormBuilderAppService.Models;

namespace FormBuilderAppService.Services
{
    public interface IFormService
    {
        List<Form> GetForms();
        Form? GetFormById(Guid formId);
        Guid SaveForm(Form model);
        void UpdateForm(Form model);
    }
}
