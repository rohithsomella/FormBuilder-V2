namespace FormBuilderAppService.Models
{
    public class ResourceGroup
    {
        public string ResourceType { get; set; }

        public int ItemCount { get; set; }

        public string ComponentsList { get; set; }

        public DateTime CreatedDate { get; set; }
    }
}
