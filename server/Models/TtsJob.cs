namespace server.Models;

public enum TtsJobStatus { Pending, Processing, Done, Failed }

public class TtsJob
{
    public int Id { get; set; }
    public int AudiobookId { get; set; }
    public int TrackNumber { get; set; }
    public string ChapterTitle { get; set; } = string.Empty;
    public TtsJobStatus Status { get; set; } = TtsJobStatus.Pending;
    public string? OutputPath { get; set; }
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Audiobook Audiobook { get; set; } = null!;
}
