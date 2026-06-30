namespace server.Models;

public class AudioFile
{
    public int Id { get; set; }
    public int AudiobookId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int TrackNumber { get; set; }
    public double Duration { get; set; }
    public string FileUrl { get; set; } = string.Empty;

    public Audiobook Audiobook { get; set; } = null!;
}
