namespace FormBuilderAppService.Models
{
    public class Resource
    {
        public Guid ResourceId { get; set; }

        public string ResourceType { get; set; }

        public string ComponentName { get; set; }

        public string? Description { get; set; }

        public string ResourceJson { get; set; }

        public DateTime CreatedDate { get; set; }

        public DateTime ModifiedDate { get; set; }

        public bool IsDeleted { get; set; }
    }
}
