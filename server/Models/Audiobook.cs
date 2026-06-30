namespace server.Models;

public class Audiobook
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string? CoverUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int? LastTrackId { get; set; }
    public double LastPosition { get; set; } = 0;
    public string? LastTrackTitle { get; set; }
    public DateTime? LastListenedAt { get; set; }

    public ICollection<AudioFile> AudioFiles { get; set; } = [];
}
